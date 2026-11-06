using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace KuwaitCity
{
    /** Every type is assembled from 3D primitives, grouped once per material, with three detail tiers. */
    public sealed class ModelBaker
    {
        private readonly Dictionary<Material,List<CombineInstance>> batches=new();
        private readonly CityPalette palette;
        private readonly int detail;
        public ModelBaker(CityPalette palette,int detail) { this.palette=palette;this.detail=Mathf.Clamp(detail,0,2); }
        public Dictionary<Material,Mesh> Bake(BuildingKind kind,int level)
        {
            var m=palette;
            var box=new Part(this);
            box.Cube(m.pale,new Vector3(0,.09f,0),new Vector3(1.72f,.18f,1.62f));
            switch(kind)
            {
                case BuildingKind.Villa:
                    box.Cube(m.limestone,new Vector3(0,.63f,0),new Vector3(1.25f,.91f,1f));
                    box.Cube(m.pale,new Vector3(0,1.13f,0),new Vector3(1.42f,.12f,1.16f));
                    box.Cube(m.teal,new Vector3(0,.54f,.525f),new Vector3(.27f,.64f,.05f));
                    box.Windows(1.25f,1f,.72f,.22f);
                    if(detail==0){box.Cube(m.pale,new Vector3(-.35f,1.3f,-.30f),new Vector3(.32f,.22f,.27f));box.Cube(m.dark,new Vector3(.35f,1.24f,-.30f),new Vector3(.31f,.09f,.27f));} break;
                case BuildingKind.Modern:
                    box.Cube(m.limestone,new Vector3(-.22f,.68f,-.10f),new Vector3(.84f,1.03f,.90f));
                    box.Cube(m.glass,new Vector3(.48f,.61f,.05f),new Vector3(.48f,.85f,.69f));
                    box.Cube(m.dark,new Vector3(.05f,1.18f,0),new Vector3(1.35f,.12f,1.06f));
                    box.Cube(m.teal,new Vector3(-.61f,.76f,.34f),new Vector3(.13f,1.06f,.17f));box.Windows(.88f,.9f,.76f,.27f);break;
                case BuildingKind.Apartments:
                    var floors=detail==2?3:Mathf.Min(level+2,5);var h=floors*.47f;
                    box.Cube(m.limestone,new Vector3(0,h/2+.17f,0),new Vector3(1.26f,h,1.06f));box.Cube(m.teal,new Vector3(0,h+.23f,0),new Vector3(1.36f,.11f,1.17f));
                    var w=detail==0?floors:3;
                    for(int i=0;i<w;i++)box.Windows(1.26f,1.06f,.41f+i*h/w,.14f);break;
                case BuildingKind.Shop:
                    box.Cube(m.limestone,new Vector3(0,.57f,-.09f),new Vector3(1.47f,.9f,.91f));box.Cube(m.teal,new Vector3(0,.9f,.46f),new Vector3(1.62f,.2f,.22f));
                    box.Cube(m.glass,new Vector3(0,.47f,.375f),new Vector3(1.20f,.51f,.04f));
                    if(detail==0)for(int i=0;i<4;i++)box.Cube(i%2==0?m.gold:m.pale,new Vector3(-.54f+i*.36f,.84f,.53f),new Vector3(.17f,.25f,.26f));break;
                case BuildingKind.Tower:
                    var t=detail==2?2.7f:2.65f+level*.42f;
                    box.Cube(m.glass,new Vector3(0,t/2+.2f,0),new Vector3(1f,t,.9f));box.Cube(m.teal,new Vector3(-.55f,t/2+.2f,0),new Vector3(.15f,t+.04f,1f));box.Cube(m.gold,new Vector3(0,t+.29f,0),new Vector3(1.14f,.11f,1.04f));
                    var floors2=detail==0?8:3;for(int i=0;i<floors2;i++)box.Windows(1f,.9f,.47f+i*t/floors2,.065f);break;
                case BuildingKind.Power:
                    box.Cube(m.dark,new Vector3(-.16f,.55f,.02f),new Vector3(1.11f,.88f,1.0f));
                    foreach(var x in new[]{-.43f,.26f}){box.Cylinder(m.pale,new Vector3(x,.78f,-.22f),.23f,1.23f);box.Cylinder(m.teal,new Vector3(x,1.42f,-.22f),.24f,.12f);}
                    if(detail<2)for(int i=0;i<3;i++)box.Cube(m.pale,new Vector3(.66f,.32f+i*.21f,.35f),new Vector3(.27f,.08f,.38f));break;
                case BuildingKind.Water:
                    foreach(var x in new[]{-.46f,0f,.46f}){box.Cylinder(m.limestone,new Vector3(x,.63f,0),.21f,.9f);box.Cylinder(m.teal,new Vector3(x,1.12f,0),.22f,.2f,1,0.03f);}box.Cube(m.glass,new Vector3(0,.34f,.46f),new Vector3(1.42f,.34f,.24f));break;
                case BuildingKind.Police:case BuildingKind.Clinic:case BuildingKind.School:case BuildingKind.Fire:
                    box.Cube(m.limestone,new Vector3(0,.56f,0),new Vector3(1.42f,.86f,1.04f));
                    box.Cube(kind==BuildingKind.Clinic||kind==BuildingKind.Fire?m.teal:m.gold,new Vector3(0,1.04f,0),new Vector3(1.6f,.14f,1.2f));
                    if(kind==BuildingKind.Fire)box.Cube(m.dark,new Vector3(0,.44f,.55f),new Vector3(.85f,.54f,.045f));
                    else box.Windows(1.42f,1.04f,.64f,.25f);
                    if(detail==0&&kind==BuildingKind.Clinic){box.Cube(m.pale,new Vector3(.41f,.81f,.552f),new Vector3(.33f,.08f,.045f));box.Cube(m.pale,new Vector3(.41f,.81f,.558f),new Vector3(.08f,.26f,.045f));}break;
                case BuildingKind.Park:
                    box.Cube(m.leaf,new Vector3(0,.20f,0),new Vector3(1.69f,.06f,1.58f));box.Cube(m.pale,new Vector3(0,.25f,0),new Vector3(.20f,.04f,1.57f));box.Cube(m.pale,new Vector3(0,.25f,0),new Vector3(1.67f,.04f,.20f));
                    box.Sphere(m.leaf,new Vector3(-.57f,1.29f,-.47f),new Vector3(.76f,.27f,.76f));box.Cylinder(m.gold,new Vector3(-.57f,.77f,-.47f),.06f,.98f);
                    box.Sphere(m.leaf,new Vector3(.55f,1.29f,.47f),new Vector3(.76f,.27f,.76f));box.Cylinder(m.gold,new Vector3(.55f,.77f,.47f),.06f,.98f);break;
                case BuildingKind.Kuwait:
                    box.Cylinder(m.pale,new Vector3(0,.18f,0),.88f,.18f,18);
                    box.Cylinder(m.limestone,new Vector3(-.28f,1.98f,0),.09f,3.6f,12,.32f);
                    box.Cylinder(m.limestone,new Vector3(.28f,1.63f,0),.10f,2.84f,12,.35f);
                    box.Cylinder(m.limestone,new Vector3(.62f,1.08f,0),.052f,1.7f,8,.4f);
                    box.Sphere(m.teal,new Vector3(-.28f,1.78f,0),Vector3.one*.78f);
                    if(detail==0){box.Sphere(m.teal,new Vector3(-.28f,2.60f,0),Vector3.one*.55f);box.Cylinder(m.gold,new Vector3(-.28f,2.24f,0),.35f,.035f);}
                    box.Sphere(m.teal,new Vector3(.28f,1.91f,0),Vector3.one*.66f);
                    box.Cylinder(m.gold,new Vector3(-.28f,3.85f,0),.021f,.24f,8,.3f);break;
                case BuildingKind.Mosque:
                    box.Cube(m.limestone,new Vector3(0,.59f,-.08f),new Vector3(1.41f,.95f,1.2f));box.Cube(m.gold,new Vector3(0,1.10f,-.08f),new Vector3(1.54f,.12f,1.32f));
                    box.Sphere(m.teal,new Vector3(0,1.27f,-.08f),new Vector3(1.02f,.86f,1.02f));box.Cylinder(m.gold,new Vector3(0,1.78f,-.08f),.025f,.27f);
                    box.Cylinder(m.limestone,new Vector3(.63f,1.17f,.43f),.085f,1.93f);box.Cylinder(m.teal,new Vector3(.63f,2.25f,.43f),.15f,.29f,10,.03f);box.Windows(1.41f,1.2f,.66f,.37f);break;
                case BuildingKind.Liberation:
                    box.Cylinder(m.limestone,new Vector3(0,1.64f,0),.25f,2.78f,10,.5f);box.Cylinder(m.teal,new Vector3(0,2.77f,0),.26f,.55f);
                    box.Cylinder(m.gold,new Vector3(0,3.1f,0),.21f,.2f);box.Cylinder(m.pale,new Vector3(0,3.58f,0),.068f,.92f,8,.04f);
                    if(detail==0)for(int i=0;i<3;i++)box.Cylinder(m.teal,new Vector3(0,.67f+i*.4f,0),.25f,.08f);break;
                case BuildingKind.Palace:
                    box.Cube(m.limestone,new Vector3(0,.58f,-.11f),new Vector3(1.7f,.83f,.97f));box.Cube(m.teal,new Vector3(0,1.05f,-.11f),new Vector3(1.88f,.14f,1.15f));
                    box.Windows(1.7f,.97f,.64f,.39f);box.Cube(m.pale,new Vector3(0,.45f,.54f),new Vector3(.44f,.58f,.36f));box.Cylinder(m.limestone,new Vector3(0,1.28f,.46f),.12f,.88f);box.Cylinder(m.gold,new Vector3(0,1.84f,.46f),.18f,.23f,10,.04f);break;
                case BuildingKind.Boubyan:
                    box.Cube(m.glass,new Vector3(-.11f,2f,0),new Vector3(.97f,3.5f,.82f));box.Cube(m.teal,new Vector3(-.57f,1.08f,0),new Vector3(.14f,1.68f,.86f));
                    var h2=detail==0?11:4;for(int i=0;i<h2;i++)box.Windows(.97f-i*.03f,.82f,.42f+i*3f/h2,.065f);
                    box.Cylinder(m.gold,new Vector3(-.11f,3.9f,0),.03f,.37f,6);break;
            }
            return Finish();
        }
        private Dictionary<Material,Mesh> Finish()
        {
            var output=new Dictionary<Material,Mesh>();
            foreach(var pair in batches)
            {
                var mesh=new Mesh{name=pair.Key.name,indexFormat=IndexFormat.UInt32};
                mesh.CombineMeshes(pair.Value.ToArray(),true,true);mesh.RecalculateNormals();mesh.RecalculateBounds();
                foreach(var batch in pair.Value)UnityEngine.Object.Destroy(batch.mesh);
                output.Add(pair.Key,mesh);
            }
            batches.Clear();return output;
        }
        private sealed class Part
        {
            private readonly ModelBaker baker;
            public Part(ModelBaker baker){this.baker=baker;}
            private void Add(Material mat,Mesh mesh,Vector3 at,Vector3 scale)
            {
                if(!baker.batches.TryGetValue(mat,out var list)){list=new List<CombineInstance>();baker.batches[mat]=list;}
                list.Add(new CombineInstance{mesh=mesh,transform=Matrix4x4.TRS(at,Quaternion.identity,scale),subMeshStartIndex=0});
            }
            public void Cube(Material mat,Vector3 at,Vector3 scale){Add(mat,Primitive.Cube(),at,scale);}
            public void Cylinder(Material mat,Vector3 at,float radius,float height,int sides=10,float top=1f){Add(mat,Primitive.Cylinder(radius,height,sides,top),at,Vector3.one);}
            public void Sphere(Material mat,Vector3 at,Vector3 scale){Add(mat,Primitive.Sphere(baker.detail==0?12:7),at,scale);}
            public void Windows(float width,float depth,float y,float h)
            {
                Cube(baker.palette.windows,new Vector3(0,y,depth/2+.022f),new Vector3(width*.74f,h,.025f));
                Cube(baker.palette.windows,new Vector3(width/2+.022f,y,0),new Vector3(.025f,h,depth*.74f));
            }
        }
    }

    public static class CityMeshes
    {
        public static Dictionary<Material,Mesh> Building(BuildingKind kind,int level,int lod,CityPalette palette){return new ModelBaker(palette,lod).Bake(kind,level);}
        public static Mesh Palm()
        {
            var batch=new ModelBakerPaletteOnly();
            var leaf=Primitive.Sphere(7);
            var sticks=Primitive.Cylinder(.06f,1.2f,6);
            var buffers=new List<CombineInstance>{new CombineInstance{mesh=sticks,transform=Matrix4x4.TRS(new Vector3(0,.6f,0),Quaternion.identity,Vector3.one)},new CombineInstance{mesh=leaf,transform=Matrix4x4.TRS(new Vector3(0,1.17f,0),Quaternion.identity,new Vector3(.75f,.25f,.75f))}};
            var m=new Mesh{name="Instanced date palm",indexFormat=IndexFormat.UInt32};m.CombineMeshes(buffers.ToArray(),true,true);m.RecalculateNormals();m.RecalculateBounds();UnityEngine.Object.Destroy(leaf);UnityEngine.Object.Destroy(sticks);return m;
        }
    }
    internal sealed class ModelBakerPaletteOnly { }
}
