using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KuwaitCity
{
    /** Coordinates simulation, 3D visuals and UI without making a technical preview part of a save. */
    [DefaultExecutionOrder(20)]
    public sealed class CityApp : MonoBehaviour
    {
        private const string SaveKey="omdat-kuwait-unity-v1";
        [SerializeField] private TextAsset maskFromScene;
        private CityPalette palette;
        public CitySimulation Model {get;private set;}
        public string Message {get;private set;}="استعراض أولي — ابدأ للحفاظ على مدينتك";
        private CityScenery scenery;
        private CityCamera cameraControls;
        private InstanceBatch palmBatch,vehicleBatch;
        private Transform buildingRoot;
        private readonly Dictionary<string,BuildingView> views=new();
        private DayNightController time;
        private PresentationCity demo;
        private IReadOnlyCollection<string> drawnRoads;
        private IReadOnlyList<BuildingRecord> drawnBuildings;
        private string roadFingerprint,buildingFingerprint;
        private float lastSave,lastUi,lastLod;
        private string savedAtExit;
        private bool initialized,presentingDemo;
        public BuildTool SelectedTool {get;private set;}=BuildTool.Select;
        public int ChosenBuilding {get;private set;}
        public string SelectedId {get;private set;}
        private CityResetDialog createCityConfirm;
        private bool loadedSave;

        public void InitializeGame(CityPalette cityPalette,TextAsset mask)
        {
            if(initialized)return;
            initialized=true;
            palette=cityPalette;
            CityLand.Initialize(mask==null?maskFromScene:mask);
            Model=new CitySimulation();
            var cameraObject=new GameObject("Main Camera",typeof(Camera),typeof(AudioListener));cameraObject.transform.SetParent(transform,false);cameraObject.tag="MainCamera";
            cameraControls=new GameObject("Smooth Orthographic City Camera",typeof(CityCamera)).GetComponent<CityCamera>();cameraControls.transform.SetParent(transform,false);
            cameraControls.Configure(cameraObject.GetComponent<Camera>(),null,null);
            var sun=new GameObject("URP directional sun + soft shadows",typeof(Light),typeof(DayNightController)).GetComponent<DayNightController>();
            var light=sun.GetComponent<Light>();light.type=LightType.Directional;
            time=sun.GetComponent<DayNightController>();time.Configure(light,palette.windows,palette.windows);
            scenery=new GameObject("Kuwait terrain",typeof(CityScenery)).GetComponent<CityScenery>();scenery.transform.SetParent(transform,false);scenery.BuildTerrain(palette);
            buildingRoot=new GameObject("Volumetric buildings / one-cell lots").transform;
            palmBatch=new GameObject("Palm GPU instancing",typeof(InstanceBatch)).GetComponent<InstanceBatch>();palmBatch.transform.SetParent(transform,false);palmBatch.Configure(CityMeshes.Palm(),palette.PalmMaterial);
            vehicleBatch=new GameObject("Traffic GPU instancing",typeof(InstanceBatch)).GetComponent<InstanceBatch>();vehicleBatch.transform.SetParent(transform,false);vehicleBatch.Configure(Primitive.Cube(),palette.VehicleMaterial);
            var ui=new GameObject("Arabic game interface",typeof(CityHud));ui.transform.SetParent(transform,false);
            ui.GetComponent<CityHud>().Configure(this,cameraControls,time);
            createCityConfirm=new GameObject("Reset confirmation",typeof(CityResetDialog)).GetComponent<CityResetDialog>();createCityConfirm.transform.SetParent(ui.transform,false);
            createCityConfirm.Configure(NewGame);
            cameraControls.Interacted+=OnCell;
            cameraControls.MainCamera.orthographic = true;
            if(PlayerPrefs.HasKey(SaveKey))
            {
                if(Model.DecodeAndRestore(PlayerPrefs.GetString(SaveKey),out var restore)){Message=restore;loadedSave=true;}
                else Message="الحفظ غير مقروء؛ مدينتك لم تُحذف. ابدأ أرضًا جديدة أو استرد نسخة يدويًا.";
            }
            Sync();
            if(Model.State.Started && Model.Buildings.Count>0)cameraControls.Focus(CityLand.World(Model.Buildings[0].C,Model.Buildings[0].R));
        }
        private void Awake()
        {
            // CityBootstrap provides the palette, land mask, and URP configuration explicitly.
            if(!initialized)Debug.Log("City is initialized by the Kuwait City/Application Bootstrap component.");
        }
        private void OnCell(Vector2Int cell)
        {
            if(!Model.State.Started||presentingDemo)return;
            switch(SelectedTool)
            {
                case BuildTool.Road: Model.PlaceRoad(cell.x,cell.y,out var road); Message=road;break;
                case BuildTool.Bulldoze: Model.Bulldoze(cell.x,cell.y,out var removed); Message=removed;SelectedId=null;break;
                case BuildTool.Build: Model.Place((BuildingKind)ChosenBuilding,cell.x,cell.y,out var placed); Message=placed;break;
                default:
                    var b=Model.Buildings.FirstOrDefault(x=>x.C==cell.x&&x.R==cell.y);SelectedId=b?.Id;
                    Message=b==null?"اختر مبنى أو ابدأ بالطريق":CityCatalog.Get(b.Kind).ArabicName+" · مستوى "+b.Level+" · جاهز "+Mathf.Floor((float)b.Stored)+" د.ك";break;
            }
            Sync();
        }
        public void SetTool(BuildTool tool){if(!Model.State.Started)return;SelectedTool=tool;Message=tool==BuildTool.Select?"انقر مبنى لعرض الدخل والترقية":"اختر أرضًا مناسبة في الكويت";}
        public void SetBuilding(int index)
        {
            if (!Model.State.Started) return;
            ChosenBuilding = index;
            SelectedTool = BuildTool.Build;
            Message = CityCatalog.All[index].ArabicName + " — اختر أرضًا فارغة";
        }
        public void StartGame()
        {
            if (!Model.State.Started) Model.Start();
            presentingDemo = false;
            demo = null;
            SelectedTool = BuildTool.Select;
            Message = loadedSave ? "استعدنا مدينتك المحفوظة" : "ابدأ بطريق قريب ثم ابنِ بجانبه";
            RefreshScene();
        }
        public void RequestNewCity() { createCityConfirm.Show(); }
        public void NewGame()
        {
            Model.LoadSession(new CitySave { Started = true, Speed = 1, Coins = 3200 });
            PlayerPrefs.SetString(SaveKey, Model.Encode());
            PlayerPrefs.Save();
            SelectedId = null;
            SelectedTool = BuildTool.Select;
            presentingDemo = false;
            demo = null;
            Message = "مدينة جديدة على خريطة الكويت";
            RefreshScene();
        }
        public void SaveCity()
        {
            if (!Model.State.Started) return;
            savedAtExit = Model.Encode();
            PlayerPrefs.SetString(SaveKey, savedAtExit);
            PlayerPrefs.Save();
            Message = "حُفظت المدينة على جهازك";
        }
        public void Collect()
        {
            if (!Model.State.Started) return;
            var coins = Model.CollectAll();
            Message = "تم تحصيل " + coins + " د.ك";
            RefreshScene();
        }
        public void UpgradeSelected()
        {
            if (string.IsNullOrEmpty(SelectedId)) { Message = "اختر المبنى من الخريطة"; return; }
            Model.Upgrade(SelectedId, out var message);
            Message = message;
            RefreshScene();
        }
        public string SelectedDescription()
        {
            if (string.IsNullOrEmpty(SelectedId)) return "";
            var building = Model.Buildings.FirstOrDefault(b => b.Id == SelectedId);
            if (building == null) return "";
            return CityCatalog.Get(building.Kind).ArabicName + "\nالمستوى " + building.Level + "\n" + Mathf.Floor((float)building.Stored) + " د.ك · ترقية";
        }
        public void ActivateZone()
        {
            if (!Model.State.Started) return;
            cameraControls.Interacted -= OnCell;
            cameraControls.Interacted -= OnZone;
            cameraControls.Interacted += OnZone;
            Message = "انقر خلية مركزية، وسيُنشئ مخططًا 9×9 مع الطرق، السكن، والخدمات الأساسية";
        }
        private void OnZone(Vector2Int center)
        {
            var before = Model.CurrentBuildingsCount;
            Model.PlanZone(center.x - 4, center.y - 4, center.x + 4, center.y + 4, true);
            cameraControls.Interacted -= OnZone;
            cameraControls.Interacted += OnCell;
            Message = "أحياء وشوارع جديدة — " + (Model.CurrentBuildingsCount - before) + " مبنى";
            RefreshScene();
        }
        public void RefreshScene() { roadFingerprint = null; Sync(); }
        private void Update()
        {
            if (Model == null || !initialized) return;
            if (Model.State.Started)
            {
                Model.Tick(Mathf.Min(Time.deltaTime, .5f));
                lastSave += Time.deltaTime;
                if (lastSave > 14f) { lastSave = 0; SaveCityPeriodic(); }
            }
            lastUi += Time.deltaTime;
            if (lastUi > .4f) { lastUi = 0; Sync(); }
        }
        private void LateUpdate()
        {
            if (!initialized || cameraControls.MainCamera == null) return;
            var size = cameraControls.MainCamera.orthographicSize;
            if (Mathf.Abs(size - lastLod) > .6f) { lastLod = size; RefreshModels(); }
            palmBatch?.Animate(Time.deltaTime);
            vehicleBatch?.Animate(Time.deltaTime);
        }
        private void SaveCityPeriodic()
        {
            if (Model == null || !Model.State.Started) return;
            var serialized = Model.Encode();
            if (serialized == savedAtExit) return;
            savedAtExit = serialized;
            PlayerPrefs.SetString(SaveKey, serialized);
            PlayerPrefs.Save();
        }
        private void Sync()
        {
            if (!initialized) return;
            if (presentingDemo && Model.State.Started) { presentingDemo = false; demo = null; }
            if (!Model.State.Started && Model.Buildings.Count == 0 && Model.Roads.Count == 0)
            {
                if (demo == null) demo = new PresentationCity();
                drawnRoads = demo.Roads;
                drawnBuildings = demo.Buildings;
                presentingDemo = true;
            }
            else { drawnRoads = Model.Roads; drawnBuildings = Model.Buildings; }
            var fingerprint = string.Join("|", drawnRoads);
            if (fingerprint != roadFingerprint)
            {
                roadFingerprint = fingerprint;
                palmBatch.Clear();
                scenery.BuildRoads(drawnRoads, palette, palmBatch, vehicleBatch);
            }
            var buildingKey = "";
            foreach (var b in drawnBuildings) buildingKey += b.Id + b.Level + ";";
            if (buildingKey != buildingFingerprint)
            {
                buildingFingerprint = buildingKey;
                RefreshModels();
            }
        }
        private void RefreshModels()
        {
            if (drawnBuildings == null) return;
            var ids = new HashSet<string>();
            foreach (var b in drawnBuildings)
            {
                ids.Add(b.Id);
                var lod = LODProfile.ForCamera(cameraControls.MainCamera.orthographicSize, b.Kind);
                var facing = 0;
                if (drawnRoads.Contains(CityLand.Key(b.C + 1, b.R))) facing = 90;
                else if (drawnRoads.Contains(CityLand.Key(b.C, b.R - 1))) facing = 180;
                else if (drawnRoads.Contains(CityLand.Key(b.C - 1, b.R))) facing = -90;
                views.TryGetValue(b.Id, out var view);
                if (view != null && view.Kind == b.Kind && view.Level == b.Level && view.Lod == lod && view.Rotation == facing) continue;
                if (view != null) { view.Clear(); Destroy(view.gameObject); views.Remove(b.Id); }
                var node = new GameObject("3D/" + CityCatalog.Get(b.Kind).ArabicName);
                node.transform.SetParent(buildingRoot, false);
                node.transform.localPosition = CityLand.World(b.C, b.R);
                node.transform.localRotation = Quaternion.Euler(0, facing, 0);
                view = node.AddComponent<BuildingView>();
                view.Populate(b, CityMeshes.Building(b.Kind, b.Level, lod, palette), lod);
                view.Rotation = facing;
                views.Add(b.Id, view);
            }
            var toRemove = new List<string>();
            foreach (var pair in views) if (!ids.Contains(pair.Key)) toRemove.Add(pair.Key);
            foreach (var id in toRemove)
            {
                var view = views[id];
                views.Remove(id);
                if (view != null) { view.Clear(); Destroy(view.gameObject); }
            }
        }
        private void OnApplicationPause(bool paused) { if (paused) SaveCityPeriodic(); }
        private void OnApplicationFocus(bool focused) { if (!focused) SaveCityPeriodic(); }
        private void OnDestroy()
        {
            SaveCityPeriodic();
            if (cameraControls != null) { cameraControls.Interacted -= OnCell; cameraControls.Interacted -= OnZone; }
            foreach (var view in views.Values) if (view != null) view.Clear();
            if (palmBatch != null) palmBatch.ReleaseMesh();
            if (vehicleBatch != null) vehicleBatch.ReleaseMesh();
        }
    }
}
