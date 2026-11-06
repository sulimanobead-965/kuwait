using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KuwaitCity
{
    /** Coordinates simulation, 3D visuals and UI without making a technical preview part of a save. */
    [DefaultExecutionOrder(20)]
    public sealed class CityApp : MonoBehaviour
    {
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
        private bool initialized,presentingDemo;
        public BuildTool SelectedTool {get;private set;}=BuildTool.Select;
        public int ChosenBuilding {get;private set;}
        public string SelectedId {get;private set;}
        private CityResetDialog createCityConfirm;
        private CitySessionStore sessions;
        private CityDistrictPicker districtPicker;
        private CitySectorLabels sectorLabels;
        private Font labelFont;
        private CityHud hud;
        private bool restoredSave,legacySaveBlocked;
        private int speedBeforeDistrictSelection=1;
        public bool DistrictSelectionVisible=>districtPicker!=null&&districtPicker.Visible;
        public bool HasLegacySave=>sessions!=null&&sessions.HasLegacy;

        public void InitializeGame(CityPalette cityPalette,TextAsset mask)
        {
            if(initialized)return;
            initialized=true;
            palette=cityPalette;
            CityLand.Initialize(mask==null?maskFromScene:mask);
            Model=new CitySimulation();sessions=new CitySessionStore();
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
            hud=ui.GetComponent<CityHud>();hud.Configure(this,cameraControls,time);
            createCityConfirm=new GameObject("Reset confirmation",typeof(CityResetDialog)).GetComponent<CityResetDialog>();createCityConfirm.transform.SetParent(ui.transform,false);
            createCityConfirm.Configure(ResetCity);
            labelFont=hud.Font;
            sectorLabels=new GameObject("Numbered neighborhood sectors",typeof(CitySectorLabels)).GetComponent<CitySectorLabels>();sectorLabels.transform.SetParent(transform,false);
            districtPicker=new GameObject("Neighborhood selection",typeof(CityDistrictPicker)).GetComponent<CityDistrictPicker>();districtPicker.transform.SetParent(transform,false);districtPicker.Configure(this,hud);
            cameraControls.Interacted+=OnCell;
            cameraControls.MainCamera.orthographic = true;
            try { restoredSave=sessions.RestoreInitial(Model,out var restore);Message=restore; }
            catch(Exception error)when(error is ArgumentException||error is InvalidOperationException)
            { legacySaveBlocked=true;Message="تعذّرت قراءة الحفظ؛ لم أحذف الملف القديم أو أستبدله.";Debug.LogWarning(error.Message); }
            if(Model.State.Started&&Model.Buildings.Count==0)Model.SetSpeed(0);
            RefreshSectorLabels();
            Sync();
            if(Model.State.Started && Model.Buildings.Count>0&&!CityDistricts.Valid(Model.State.District))cameraControls.Focus(CityLand.World(Model.Buildings[0].C,Model.Buildings[0].R));
            FocusDistrict();
        }
        private void Awake()
        {
            // CityBootstrap provides the palette, land mask, and URP configuration explicitly.
            if(!initialized)Debug.Log("City is initialized by the Kuwait City/Application Bootstrap component.");
        }
        private void OnCell(Vector2Int cell)
        {
            if(!Model.State.Started||presentingDemo||DistrictSelectionVisible)return;
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
        public void SetTool(BuildTool tool){if(!Model.State.Started||DistrictSelectionVisible)return;SelectedTool=tool;Message=tool==BuildTool.Select?"انقر مبنى لعرض الدخل والترقية":"اختر أرضًا مناسبة في الكويت";}
        public void SetBuilding(int index)
        {
            if (!Model.State.Started||DistrictSelectionVisible) return;
            ChosenBuilding = index;
            SelectedTool = BuildTool.Build;
            Message = CityCatalog.All[index].ArabicName + " — اختر أرضًا فارغة";
        }
        public void StartGame()
        {
            if(legacySaveBlocked){Message="الحفظ القديم غير مقروء؛ لا أبدأ مدينة جديدة فوقه. اختر أحد الأحياء.";ShowDistricts();return;}
            if (!Model.State.Started) Model.Start();
            presentingDemo = false;
            demo = null;
            SelectedTool = BuildTool.Select;
            Model.SetSpeed(1);
            Message = restoredSave ? "استعدنا مدينتك المحفوظة" : "ابدأ بطريق قريب ثم ابنِ بجانبه";
            RefreshScene();
        }
        public void RequestNewCity() {if(!DistrictSelectionVisible&&!hud.ResetVisible)createCityConfirm.Show(); }
        public void NewGame() { RequestNewCity(); }
        internal void ResetCity()
        {
            if(!sessions.ResetCurrent(Model,out var reset)){Message=reset;return;}
            ClearZoneSelection();presentingDemo=false;demo=null;restoredSave=false;
            Message=reset;RefreshSectorLabels();RefreshScene();FocusDistrict();
        }
        public void ShowDistricts(){if(createCityConfirm!=null&&hud!=null&&hud.ResetVisible)return;if(districtPicker!=null)districtPicker.Show();}
        public void CloseDistricts(){if(districtPicker==null)return;DismissDistricts();districtPicker.Close();}
        internal void DismissDistricts(){RestoreSelectionSpeed();if(legacySaveBlocked){Message="الحفظ القديم غير مقروء؛ لم أستبدله. اختر حيًا بدل بدء مدينة أصلية فوقه.";return;}Message=Model.State.Started?CityDistricts.ArabicName(Model.State.District)+" — التقدم محفوظ مستقلًا":"اختر الحي أو ابدأ مدينة الكويت الأصلية";if(Model.State.Started&&Model.State.Speed==0)Message+=" (المحاكاة متوقفة)";}
        public string DistrictName=>CityDistricts.ArabicName(Model.State.District);
        internal bool EnterDistrict(string id)
        {
            bool accepted=sessions.Choose(id,Model,out var message);Message=message;
            if(!accepted)return false;
            speedBeforeDistrictSelection=0;legacySaveBlocked=false;ClearZoneSelection();presentingDemo=false;demo=null;restoredSave=Model.Buildings.Count>0;
            RefreshSectorLabels();RefreshScene();districtPicker.Close();FocusDistrict();Message=message;return true;
        }
        internal bool EnterLegacy()
        {
            bool accepted=sessions.ResumeLegacy(Model,out var message);Message=message;
            if(!accepted)return false;
            speedBeforeDistrictSelection=0;legacySaveBlocked=false;ClearZoneSelection();presentingDemo=false;demo=null;restoredSave=true;
            RefreshSectorLabels();RefreshScene();districtPicker.Close();Message=message;return true;
        }
        public void CancelWorldTool()
        {
            cameraControls.Interacted-=OnZone;cameraControls.Interacted-=OnCell;cameraControls.Interacted+=OnCell;
            SelectedTool=BuildTool.Select;
        }
        internal void PauseForSelection(){if(DistrictSelectionVisible)return;speedBeforeDistrictSelection=Model.State.Speed;if(Model.State.Started)Model.SetSpeed(0);}
        private void RestoreSelectionSpeed(){if(Model.State.Started&&Model.State.Speed==0&&speedBeforeDistrictSelection>0)Model.SetSpeed(speedBeforeDistrictSelection);speedBeforeDistrictSelection=0;}
        private void ClearZoneSelection()
        {
            cameraControls.Interacted-=OnZone;cameraControls.Interacted-=OnCell;cameraControls.Interacted+=OnCell;
            SelectedId=null;SelectedTool=BuildTool.Select;
        }
        private void FocusDistrict()
        {
            if(!CityDistricts.Valid(Model.State.District))return;cameraControls.Focus(CityDistricts.Get(Model.State.District).Center());
        }
        private void RefreshSectorLabels()
        {if(sectorLabels!=null)sectorLabels.Rebuild(Model.State.District,labelFont);roadFingerprint=null;}
        public void SaveCity()
        {
            if (!Model.State.Started||DistrictSelectionVisible) return;
            if(TrySaveCurrent())Message="حُفظت هذه المدينة مستقلة على جهازك";
        }
        public void Collect()
        {
            if (!Model.State.Started||DistrictSelectionVisible) return;
            var coins = Model.CollectAll();
            Message = "تم تحصيل " + coins + " د.ك";
            RefreshScene();
        }
        public void UpgradeSelected()
        {
            if(DistrictSelectionVisible)return;
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
            if (!Model.State.Started||DistrictSelectionVisible) return;
            cameraControls.Interacted -= OnCell;
            cameraControls.Interacted -= OnZone;
            cameraControls.Interacted += OnZone;
            Message = "انقر خلية مركزية، وسيُنشئ مخططًا 9×9 مع الطرق، السكن، والخدمات الأساسية";
        }
        private void OnZone(Vector2Int center)
        {
            if(DistrictSelectionVisible)return;
            int x=center.x,y=center.y;
            if(CityDistricts.Valid(Model.State.District)){var p=CityDistricts.Get(Model.State.District).ParcelAt(x,y);if(p==null){Message="ابدأ التخطيط داخل قطعة مرقّمة";cameraControls.Interacted-=OnZone;cameraControls.Interacted-=OnCell;cameraControls.Interacted+=OnCell;return;}x=p.C;y=p.R;}
            var before = Model.CurrentBuildingsCount;
            Model.PlanZone(x - 4,y - 4,x + 4,y + 4,true);
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
        private bool TrySaveCurrent()
        {
            if (Model == null || !Model.State.Started||sessions==null) return false;
            try
            {
                sessions.SaveCurrent(Model);return true;
            }
            catch(Exception error)when(error is ArgumentException||error is InvalidOperationException)
            { Message="لم أستبدل حفظًا غير مقروء؛ بقيت المدينة الحالية في الذاكرة.";Debug.LogWarning(error.Message);return false; }
        }
        private void SaveCityPeriodic(){if(!DistrictSelectionVisible)TrySaveCurrent();}
        private void Sync()
        {
            if (!initialized) return;
            if (presentingDemo && Model.State.Started) { presentingDemo = false; demo = null; }
            if (!Model.State.Started && StateIsLegacyBlankModel())
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
        private bool StateIsLegacyBlankModel(){return !CityDistricts.Valid(Model.State.District)&&Model.Buildings.Count==0&&Model.Roads.Count==0;}
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
