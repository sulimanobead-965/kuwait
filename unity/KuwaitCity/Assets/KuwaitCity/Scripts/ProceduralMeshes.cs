using System.Collections.Generic;
using UnityEngine;

namespace KuwaitCity
{
    /** Real solid geometry with flat face normals, never a sprite plane. */
    public static class Primitive
    {
        private static readonly Vector3[][] CubeFaces = {
            new[]{new Vector3(-.5f,-.5f,-.5f),new Vector3(-.5f,.5f,-.5f),new Vector3(.5f,.5f,-.5f),new Vector3(.5f,-.5f,-.5f)},
            new[]{new Vector3(.5f,-.5f,.5f),new Vector3(.5f,.5f,.5f),new Vector3(-.5f,.5f,.5f),new Vector3(-.5f,-.5f,.5f)},
            new[]{new Vector3(-.5f,-.5f,.5f),new Vector3(-.5f,.5f,.5f),new Vector3(-.5f,.5f,-.5f),new Vector3(-.5f,-.5f,-.5f)},
            new[]{new Vector3(.5f,-.5f,-.5f),new Vector3(.5f,.5f,-.5f),new Vector3(.5f,.5f,.5f),new Vector3(.5f,-.5f,.5f)},
            new[]{new Vector3(-.5f,.5f,.5f),new Vector3(.5f,.5f,.5f),new Vector3(.5f,.5f,-.5f),new Vector3(-.5f,.5f,-.5f)},
            new[]{new Vector3(-.5f,-.5f,-.5f),new Vector3(.5f,-.5f,-.5f),new Vector3(.5f,-.5f,.5f),new Vector3(-.5f,-.5f,.5f)}
        };
        public static Mesh Cube()
        {
            var vertices=new List<Vector3>();var triangles=new List<int>();
            foreach(var face in CubeFaces)AddFace(vertices,triangles,face[0],face[1],face[2],face[3]);
            return Finish("Flat cube",vertices,triangles);
        }
        public static void AddFace(List<Vector3> vertices,List<int> triangles,Vector3 a,Vector3 b,Vector3 c,Vector3 d)
        {
            int index=vertices.Count;vertices.Add(a);vertices.Add(b);vertices.Add(c);vertices.Add(d);
            triangles.AddRange(new[]{index,index+1,index+2,index,index+2,index+3});
        }
        public static Mesh Cylinder(float radius,float height,int sides,float topRatio=1f)
        {
            var vertices=new List<Vector3>();var triangles=new List<int>();
            for(int i=0;i<sides;i++)
            {
                float a=i*Mathf.PI*2/sides,b=(i+1)*Mathf.PI*2/sides;
                var bottomA=new Vector3(Mathf.Cos(a)*radius,-height/2,Mathf.Sin(a)*radius);
                var bottomB=new Vector3(Mathf.Cos(b)*radius,-height/2,Mathf.Sin(b)*radius);
                var topA=bottomA*topRatio;topA.y=height/2;
                var topB=bottomB*topRatio;topB.y=height/2;
                AddFace(vertices,triangles,bottomB,bottomA,topA,topB);
                int n=vertices.Count;vertices.Add(new Vector3(0,-height/2,0));vertices.Add(bottomA);vertices.Add(bottomB);triangles.AddRange(new[]{n,n+1,n+2});
                if(topRatio>.02f){n=vertices.Count;vertices.Add(new Vector3(0,height/2,0));vertices.Add(topB);vertices.Add(topA);triangles.AddRange(new[]{n,n+1,n+2});}
            }
            return Finish("Cylinder",vertices,triangles);
        }
        public static Mesh Sphere(int sides)
        {
            int rings=Mathf.Max(3,sides/2);var vertices=new List<Vector3>();var triangles=new List<int>();
            for(int j=0;j<rings;j++)for(int i=0;i<sides;i++)
            {
                Vector3 Point(int ring,int index)
                {
                    float u=index*Mathf.PI*2/sides,v=ring*Mathf.PI/rings;
                    return new Vector3(Mathf.Sin(v)*Mathf.Cos(u),Mathf.Cos(v),Mathf.Sin(v)*Mathf.Sin(u))*.5f;
                }
                AddFace(vertices,triangles,Point(j,i),Point(j+1,i),Point(j+1,i+1),Point(j,i+1));
            }
            return Finish("Low-poly sphere",vertices,triangles);
        }
        private static Mesh Finish(string name,List<Vector3> vertices,List<int> triangles)
        {
            var mesh=new Mesh{name=name};mesh.SetVertices(vertices);mesh.SetTriangles(triangles,0);
            mesh.RecalculateNormals();mesh.RecalculateBounds();return mesh;
        }
    }

    public static class MeshCosts
    {
        public static int Triangles(Dictionary<Material,Mesh> model)
        {
            int count=0;foreach(var pair in model)count+=(int)pair.Value.GetIndexCount(0)/3;return count;
        }
        public static void Release(Dictionary<Material,Mesh> model)
        {
            if(model==null)return;
            foreach(var pair in model)if(pair.Value!=null)UnityEngine.Object.Destroy(pair.Value);
            model.Clear();
        }
    }

    /** Mesh ownership stays local to a building; rebuilt views dispose only their own meshes. */
    public sealed class BuildingView : MonoBehaviour
    {
        private readonly List<Mesh> owned=new List<Mesh>();
        public string BuildingId {get;private set;}
        public BuildingKind Kind {get;private set;}
        public int Level {get;private set;}
        public int Lod {get;private set;}
        public float Rotation {get;set;}
        public void Populate(BuildingRecord record,Dictionary<Material,Mesh> geometries,int lod)
        {
            Clear();BuildingId=record.Id;Kind=record.Kind;Level=record.Level;Lod=lod;
            foreach(var pair in geometries)
            {
                var node=new GameObject(pair.Key.name);node.transform.SetParent(transform,false);
                node.AddComponent<MeshFilter>().sharedMesh=pair.Value;
                var renderer=node.AddComponent<MeshRenderer>();renderer.sharedMaterial=pair.Key;
                owned.Add(pair.Value);
            }
        }
        public void Clear()
        {
            for(int i=transform.childCount-1;i>=0;i--)Destroy(transform.GetChild(i).gameObject);
            foreach(var mesh in owned)if(mesh!=null)Destroy(mesh);
            owned.Clear();
        }
        private void OnDestroy(){Clear();}
    }
}
