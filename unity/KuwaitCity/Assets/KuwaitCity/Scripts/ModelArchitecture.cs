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
                    // A courtyard is visibly empty, enclosed by low two-storey wings.
                    box.Cube(m.sand,new Vector3(0,.06f,0),new Vector3(2.03f,.12f,1.94f));
                    box.Cube(m.pale,new Vector3(0,.13f,.01f),new Vector3(.98f,.035f,1.12f));
                    box.Cube(m.pale,new Vector3(0,.69f,-.66f),new Vector3(1.96f,1.05f,.52f));
                    foreach(var x in new[]{-.77f,.77f})
                    {
                        box.Cube(m.pale,new Vector3(x,.55f,.1f),new Vector3(.42f,.84f,1f));
                        box.Cube(m.limestone,new Vector3(x,1.0f,.1f),new Vector3(.47f,.11f,1.06f));
                        for(int z=0;z<4;z++)box.Cube(m.pale,new Vector3(x+(x<0?-.19f:.19f),1.1f,-.29f+z*.25f),new Vector3(.1f,.17f,.12f));
                    }
                    foreach(var x in new[]{-.6f,.6f})
                    {
                        box.Cube(m.pale,new Vector3(x,.52f,.72f),new Vector3(.76f,.80f,.43f));
                        box.Cube(m.pale,new Vector3(x,.94f,.72f),new Vector3(.78f,.08f,.45f));
                        box.WoodLatch(new Vector3(x,.59f,.94f),.20f,.34f);
                        for(int i=0;i<3;i++)box.Cube(m.pale,new Vector3(x-.25f+i*.25f,1.055f,.94f),new Vector3(.105f,.18f,.075f));
                    }
                    box.Cube(m.pale,new Vector3(0,.98f,.72f),new Vector3(.46f,.36f,.43f));
                    box.WoodLatch(Vector3.zero+new Vector3(0,.52f,.945f),.38f,.72f);
                    foreach(var x in new[]{-.25f,.25f})box.Cylinder(m.pale,new Vector3(x,.47f,.99f),.033f,.7f,8);
                    box.Cube(m.pale,new Vector3(0,.85f,.99f),new Vector3(.66f,.095f,.15f));
                    box.Cube(m.water,new Vector3(0,.15f,.01f),new Vector3(.36f,.026f,.105f));box.Cube(m.water,new Vector3(0,.15f,.01f),new Vector3(.105f,.026f,.36f));
                    box.Cylinder(m.sand,new Vector3(.3f,.48f,.25f),.033f,.70f,7,.7f);box.Sphere(m.leaf,new Vector3(.3f,.88f,.25f),new Vector3(.42f,.10f,.42f));
                    if(detail<2)
                    {
                        for(int i=0;i<9;i++)box.Cube(m.pale,new Vector3(-.85f+i*.21f,1.34f,-.90f),new Vector3(.13f,.19f,.09f));
                        foreach(var x in new[]{-.62f,0f,.64f})box.WoodLatch(new Vector3(x,.8f,-.377f),.20f,.31f);
                        box.Cube(m.pale,new Vector3(-.47f,1.44f,-.65f),new Vector3(.42f,.47f,.38f));
                        box.Lattice(new Vector3(-.47f,1.45f,-.445f),.32f,.3f);box.Cube(m.pale,new Vector3(-.47f,1.72f,-.65f),new Vector3(.51f,.09f,.46f));
                        box.Cube(m.sand,new Vector3(1.025f,.09f,.41f),new Vector3(.25f,.12f,.6f));box.Sphere(m.leaf,new Vector3(1.03f,.25f,.51f),new Vector3(.3f,.37f,.3f));
                    }
                    break;
                case BuildingKind.Modern:
                    box.Cube(m.limestone,new Vector3(-.22f,.68f,-.10f),new Vector3(.84f,1.03f,.90f));
                    box.Cube(m.glass,new Vector3(.48f,.61f,.05f),new Vector3(.48f,.85f,.69f));
                    box.Cube(m.dark,new Vector3(.05f,1.18f,0),new Vector3(1.35f,.12f,1.06f));
                    box.Cube(m.pale,new Vector3(-.28f,1.2f,-.26f),new Vector3(1.31f,.31f,1.2f));
                    box.Cube(m.pale,new Vector3(.5f,1.03f,.4f),new Vector3(.9f,.09f,.54f));
                    box.Cube(m.wood,new Vector3(-.43f,.58f,.375f),new Vector3(.31f,.65f,.035f));
                    box.Cube(m.dark,new Vector3(.51f,.66f,.422f),new Vector3(.04f,.74f,.04f));
                    if(detail<2)
                    {
                        box.Cube(m.glass,new Vector3(.46f,1.15f,.67f),new Vector3(.88f,.24f,.028f));box.Cube(m.dark,new Vector3(.48f,1.29f,.68f),new Vector3(.92f,.032f,.034f));
                        foreach(var x in new[]{.03f,.47f,.92f})box.Cube(m.dark,new Vector3(x,1.15f,.685f),new Vector3(.024f,.27f,.03f));
                        for(int i=0;i<6;i++)box.Cube(m.dark,new Vector3(-.76f,.54f,.1f+i*.09f),new Vector3(.035f,.7f,.03f));
                        box.Cube(m.dark,new Vector3(.15f,1.53f,-.28f),new Vector3(.45f,.22f,.35f));
                    }break;
                case BuildingKind.Apartments:
                    var floors=detail==2?3:Mathf.Min(level+1,4);var h=floors*.48f;
                    box.Cube(m.limestone,new Vector3(0,h/2+.16f,-.05f),new Vector3(1.44f,h,1.14f));
                    for(int f=0;f<floors;f++)
                    {
                        float y=.29f+f*.48f;box.Cube(m.pale,new Vector3(0,y,-.05f),new Vector3(1.58f,.075f,1.29f));
                        if(detail<2)foreach(var x in new[]{-.37f,.37f})
                        {
                            box.Cube(m.glass,new Vector3(x,y+.25f,.545f),new Vector3(.34f,.27f,.035f));
                            box.Cube(m.limestone,new Vector3(x,y+.10f,.59f),new Vector3(.48f,.07f,.17f));
                            box.Cube(m.pale,new Vector3(x,y+.22f,.668f),new Vector3(.46f,.035f,.035f));
                            for(int i=0;i<3;i++)box.Cube(m.pale,new Vector3(x-.20f+i*.2f,y+.15f,.665f),new Vector3(.025f,.16f,.03f));
                        }
                        box.Cube(m.glass,new Vector3(.75f,y+.24f,-.3f),new Vector3(.035f,.22f,.28f));
                    }
                    box.Cube(m.pale,new Vector3(0,h+.20f,-.05f),new Vector3(1.56f,.08f,1.24f));
                    if(detail==0)
                    {
                        foreach(var x in new[]{.31f,.57f})foreach(var z in new[]{-.36f,-.1f})box.Cube(m.dark,new Vector3(x,h+.29f,z),new Vector3(.035f,.22f,.035f));
                        box.Cylinder(m.pale,new Vector3(.44f,h+.56f,-.23f),.30f,.45f,16);
                        box.Cube(m.sand,new Vector3(-.35f,h+.33f,-.26f),new Vector3(.28f,.17f,.23f));
                    }break;
                case BuildingKind.Shop:
                    box.Cube(m.limestone,new Vector3(0,.57f,-.09f),new Vector3(1.47f,.9f,.91f));box.Cube(m.teal,new Vector3(0,.9f,.46f),new Vector3(1.62f,.2f,.22f));
                    box.Cube(m.glass,new Vector3(0,.47f,.375f),new Vector3(1.20f,.51f,.04f));
                    if(detail==0)for(int i=0;i<4;i++)box.Cube(i%2==0?m.gold:m.pale,new Vector3(-.54f+i*.36f,.84f,.53f),new Vector3(.17f,.25f,.26f));break;
                case BuildingKind.Tower:
                    var t=detail==2?2.65f:2.45f+level*.27f;
                    box.Cube(m.glass,new Vector3(0,t/2+.20f,0),new Vector3(1.15f,t,.98f));
                    var floors2=detail==0?7:4;
                    for(int i=0;i<=floors2;i++)box.Cube(m.pale,new Vector3(0,.23f+i*t/floors2,-.02f),new Vector3(1.35f,.065f,1.16f));
                    foreach(var x in new[]{-.59f,-.18f,.18f,.59f})foreach(var z in new[]{-.5f,.5f})box.Cube(m.pale,new Vector3(x,t/2+.20f,z),new Vector3(.067f,t,.067f));
                    foreach(var z in new[]{-.27f,.04f,.34f})foreach(var x in new[]{-.61f,.61f})box.Cube(m.pale,new Vector3(x,t/2+.20f,z),new Vector3(.067f,t,.067f));
                    box.Cube(m.pale,new Vector3(0,t+.23f,0),new Vector3(1.44f,.10f,1.23f));box.Cube(m.asphalt,new Vector3(0,t+.288f,0),new Vector3(1.23f,.02f,1.02f));
                    if(detail==0)
                    {
                        box.Cylinder(m.gold,new Vector3(-.21f,t+.303f,-.02f),.33f,.018f,20);
                        box.Cube(m.silver,new Vector3(-.21f,t+.319f,-.02f),new Vector3(.05f,.017f,.26f));
                        box.Cube(m.dark,new Vector3(.36f,t+.35f,-.29f),new Vector3(.33f,.13f,.23f));
                    }break;
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
                    int sides=detail==0?32:detail==1?20:12;int tiers=detail==0?12:detail==1?7:3;
                    box.Mesh(m.glass,Primitive.BoubyanTower(3.65f,sides,tiers,out _,out _),Vector3.zero);
                    box.Cube(m.pale,new Vector3(0,.19f,0),new Vector3(1.94f,.38f,1.59f));box.Cube(m.silver,new Vector3(0,.42f,0),new Vector3(1.76f,.14f,1.39f));
                    int fins=detail==0?28:detail==1?16:8;
                    for(int i=0;i<fins;i++)
                    {
                        float angle=i*Mathf.PI*2/fins;var offset=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle))*.026f;
                        box.Beam(m.silver,Primitive.BoubyanPoint(0,angle,3.65f)+offset,Primitive.BoubyanPoint(1,angle,3.65f)+offset,.026f);
                    }
                    if(detail<2)for(int i=0;i<sides;i++)
                    {
                        float angle=i*Mathf.PI*2/sides;
                        box.Cube(m.dark,Primitive.BoubyanPoint(.63f,angle,3.65f),new Vector3(.045f,.042f,.045f));
                        box.Cube(m.dark,Primitive.BoubyanPoint(.87f,angle,3.65f),new Vector3(.045f,.042f,.045f));
                    }
                    break;
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
            public void Add(Material mat,Mesh mesh,Vector3 at,float yScale,Quaternion rotation,Vector3 scale)
            {
                scale.y*=yScale;if(!baker.batches.TryGetValue(mat,out var list)){list=new List<CombineInstance>();baker.batches[mat]=list;}
                list.Add(new CombineInstance{mesh=mesh,transform=Matrix4x4.TRS(at,rotation,scale),subMeshStartIndex=0});
            }
            public void Cube(Material mat,Vector3 at,Vector3 scale){Add(mat,Primitive.Cube(),at,scale);}
            public void Cylinder(Material mat,Vector3 at,float radius,float height,int sides=10,float top=1f){Add(mat,Primitive.Cylinder(radius,height,sides,top),at,Vector3.one);}
            public void Sphere(Material mat,Vector3 at,Vector3 scale){Add(mat,Primitive.Sphere(baker.detail==0?12:7),at,scale);}
            public void Mesh(Material mat,Mesh mesh,Vector3 at){Add(mat,mesh,at,Vector3.one);}
            public void WoodLatch(Vector3 at,float width,float height)
            {
                Cube(baker.palette.pale,at,new Vector3(width+.06f,height+.05f,.04f));
                Cube(baker.palette.wood,at+new Vector3(0,0,.025f),new Vector3(width,height,.035f));
                foreach(var dx in new[]{-.25f,.25f})Cube(baker.palette.sand,at+new Vector3(width*dx,0,.045f),new Vector3(.023f,height,.02f));
                Cube(baker.palette.sand,at+new Vector3(0,height*.2f,.045f),new Vector3(width,.026f,.023f));
            }
            public void Lattice(Vector3 at,float width,float height)
            {
                Cube(baker.palette.wood,at,new Vector3(width,height,.027f));
                for(int i=0;i<3;i++)Cube(baker.palette.sand,at+new Vector3(width*(i-1)/3,0,.02f),new Vector3(.024f,height,.025f));
                for(int i=0;i<3;i++)Cube(baker.palette.sand,at+new Vector3(0,height*(i-1)/3,.02f),new Vector3(width,.024f,.025f));
            }
            public void Beam(Material mat,Vector3 a,Vector3 b,float width)
            {
                var direction=b-a;Add(mat,Primitive.Cube(),(a+b)*.5f,direction.magnitude,Quaternion.FromToRotation(Vector3.up,direction.normalized),new Vector3(width,1f,width));
            }
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
