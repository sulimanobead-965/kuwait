using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace KuwaitCity
{
    /** A separate illustrative district. Starting a game replaces it; never serializes it into PlayerPrefs. */
    public sealed class PresentationCity
    {
        private readonly List<BuildingRecord> buildings=new();
        public IReadOnlyList<BuildingRecord> Buildings {get{return buildings;}}
        public IReadOnlyList<string> Roads {get{return roadKeys;}}
        private readonly List<string> roadKeys=new();
        public bool Active {get{return buildings.Count>0&&roads.Count>0;}}
        private readonly List<string> roads=new(){ "17,23","18,23","19,23","20,23","21,23","22,23","23,23","24,23","25,23","26,23","27,23","28,23","29,23","30,23","31,23","32,23","19,24","19,25","19,26","19,27","19,28","23,21","23,22","23,24","23,25","23,26","23,27","23,28","27,21","27,22","27,21","27,24","27,25","27,26","27,27","27,28","31,24","31,25","31,26","31,27","31,28" };
        public PresentationCity()
        {
            foreach(var key in roads)if(!roadKeys.Contains(key))roadKeys.Add(key);
            Add(BuildingKind.Villa,18,24);Add(BuildingKind.Modern,20,24);Add(BuildingKind.Apartments,21,24,2);Add(BuildingKind.Shop,22,24);
            Add(BuildingKind.Power,25,24);Add(BuildingKind.Water,26,24);Add(BuildingKind.Park,30,24);
            Add(BuildingKind.Palace,18,22);Add(BuildingKind.Mosque,22,22);Add(BuildingKind.Boubyan,24,22,2);Add(BuildingKind.Liberation,26,22,2);
            Add(BuildingKind.Kuwait,28,22,2);Add(BuildingKind.Tower,30,22,2);Add(BuildingKind.Clinic,18,25);Add(BuildingKind.School,20,25);
        }
        private void Add(BuildingKind kind,int c,int r,int level=1)
        {
            if(CityLand.IsLand(c,r))buildings.Add(new BuildingRecord(kind,c,r,level){Id="presentation-"+kind});
        }
    }

    public sealed class CityScenery : MonoBehaviour
    {
        private readonly List<GameObject> childNodes=new();
        private readonly List<Mesh> generated=new();
        private readonly List<Mesh> roadMeshes=new();
        private Transform roadRoot;
        public void BuildTerrain(CityPalette palette)
        {
            DisposeChildren();
            var land=new List<List<CombineInstance>>();
            for(int i=0;i<4;i++)land.Add(new List<CombineInstance>());
            var cellSize=CityLand.CellSize;
            for(int r=0;r<CityLand.Rows;r++)for(int c=0;c<CityLand.Columns;c++)
            {
                if(!CityLand.IsLand(c,r))continue;
                var world=CityLand.World(c,r);
                var coastal=CityLand.Coastal(c,r);
                Box(land[coastal?2:(c+r)%2],new Vector3(world.x,.13f,world.z),new Vector3(cellSize,.34f,cellSize));
                foreach(var d in CityLand.Directions)if(!CityLand.IsLand(c+d.x,r+d.y))
                {
                    var size=d.x!=0?new Vector3(.15f,.43f,cellSize):new Vector3(cellSize,.43f,.15f);
                    Box(land[3],world+new Vector3(d.x*cellSize*.5f,-.075f,d.y*cellSize*.5f),size);
                }
            }
            var mats=new[]{palette.land,palette.sand,palette.limestone,palette.pale};
            for(int i=0;i<mats.Length;i++)Merge("Terrain / "+i,mats[i],land[i],null);
            var water=new GameObject("Gulf volume / not an image");water.transform.SetParent(transform,false);
            water.transform.localScale=new Vector3(245,.20f,195);water.transform.localPosition=new Vector3(0,-.27f,0);
            water.AddComponent<MeshFilter>().sharedMesh=Primitive.Cube();water.AddComponent<MeshRenderer>().sharedMaterial=palette.water;
            childNodes.Add(water);
        }
        public void BuildRoads(IReadOnlyCollection<string> roads,CityPalette palette,InstanceBatch palmBatch,InstanceBatch vehicleBatch)
        {

            if(roadRoot!=null)
            {
                for(int i=roadRoot.childCount-1;i>=0;i--)Destroy(roadRoot.GetChild(i).gameObject);
                foreach(var mesh in roadMeshes)if(mesh!=null)Destroy(mesh);
                roadMeshes.Clear();Destroy(roadRoot.gameObject);roadRoot=null;
            }
            roadRoot=new GameObject("Merged road network").transform;roadRoot.SetParent(transform,false);

            var asphalt=new List<CombineInstance>();var markings=new List<CombineInstance>();
            foreach(var cell in roads)
            {
                if(!CityLand.TryCell(cell,out var c,out var r))continue;
                var at=CityLand.World(c,r);
                // Uninterrupted charcoal asphalt, with neither a pale paving
                // underlay nor a bright perimeter border. All paint is interior only.
                Box(asphalt,at+new Vector3(0,.306f,0),new Vector3(CityLand.CellSize,.016f,CityLand.CellSize));
                foreach(var mark in RoadPaintLayout.At(roads,c,r))
                    Box(markings,at+new Vector3(mark.DC*CityLand.CellSize*.35f,.324f,mark.DR*CityLand.CellSize*.35f),new Vector3(mark.Kind==RoadPaintKind.Dash?CityLand.CellSize*.27f:.052f,.005f,mark.Kind==RoadPaintKind.Dash?.052f:CityLand.CellSize*.27f));
                bool horizontal=roads.Contains(CityLand.Key(c+1,r))||roads.Contains(CityLand.Key(c-1,r));
                bool vertical=roads.Contains(CityLand.Key(c,r-1))||roads.Contains(CityLand.Key(c,r+1));
                if((c+r)%4==0&&(horizontal||vertical))
                {
                    var lamp=at+(horizontal?new Vector3(0,.76f,-.99f):new Vector3(.89f,.76f,0));
                    Box(asphalt,lamp,new Vector3(.045f,.90f,.045f));
                    var cap=lamp+(horizontal?new Vector3(0,.43f,.08f):new Vector3(-.08f,.43f,0));
                    Box(asphalt,cap,horizontal?new Vector3(.045f,.05f,.21f):new Vector3(.21f,.05f,.045f));
                }
                if((c*7+r*13)%6==0)if(palmBatch!=null)palmBatch.Add(at+new Vector3(.79f,.02f,.77f),Quaternion.identity,Vector3.one);
            }
            Merge("Roads / asphalt",palette.asphalt,asphalt,roadRoot);
            var paintMesh=Merge("Roads / batched interior paint",palette.roadMark,markings,roadRoot);
            if(paintMesh!=null)roadMeshes.Add(paintMesh);
            if(vehicleBatch!=null)
            {
                vehicleBatch.Clear();int i=0;
                foreach(var cell in roads){if(++i%7!=0)continue;if(CityLand.TryCell(cell,out var c,out var r))
                {
                    bool horizontal=roads.Contains(CityLand.Key(c+1,r))||roads.Contains(CityLand.Key(c-1,r));
                    var axis=horizontal?Vector3.right:Vector3.forward;
                    vehicleBatch.Add(CityLand.World(c,r)+new Vector3(0,.39f,-.17f),horizontal?Quaternion.Euler(0,90,0):Quaternion.identity,new Vector3(.31f,.18f,.65f));
                    vehicleBatch.SetAxis(vehicleBatch.Count-1,axis);
                }}
            }
        }
        private static void Box(List<CombineInstance> parts,Vector3 at,Vector3 scale)
        {parts.Add(new CombineInstance{mesh=Primitive.Cube(),transform=Matrix4x4.TRS(at,Quaternion.identity,scale)});}
        private Mesh Merge(string label,Material material,List<CombineInstance> parts,Transform root)
        {
            if(parts.Count==0)return null;
            var mesh=new Mesh{name=label,indexFormat=IndexFormat.UInt32};mesh.CombineMeshes(parts.ToArray(),true,true);mesh.RecalculateNormals();mesh.RecalculateBounds();
            foreach(var part in parts)UnityEngine.Object.Destroy(part.mesh);
            var node=new GameObject(label);node.transform.SetParent(root==null?transform:root,false);node.isStatic=true;
            node.AddComponent<MeshFilter>().sharedMesh=mesh;var renderer=node.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.receiveShadows=true;
            generated.Add(mesh);childNodes.Add(node);return mesh;
        }
        public void DisposeChildren()
        {
            foreach(var node in childNodes)if(node!=null){var mesh=node.GetComponent<MeshFilter>()?.sharedMesh;if(mesh!=null)UnityEngine.Object.Destroy(mesh);UnityEngine.Object.Destroy(node);}
            childNodes.Clear();generated.Clear();roadMeshes.Clear();roadRoot=null;
        }
        private void OnDestroy(){DisposeChildren();}
    }

    public static class LODProfile
    {
        public static int ForCamera(float size,BuildingKind kind)
        {
            bool landmark=kind==BuildingKind.Kuwait||kind==BuildingKind.Liberation||kind==BuildingKind.Boubyan;
            if(size<23f)return 0;
            if(size<40f||landmark)return 1;
            return 2;
        }
    }

}
