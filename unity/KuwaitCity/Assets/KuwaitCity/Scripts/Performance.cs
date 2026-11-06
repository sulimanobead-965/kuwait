using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace KuwaitCity
{
    /** Always records every primitive prior to combining to validate model level-of-detail tests. */
    public static class PrimitiveBudget
    {
        public static int TriangleCount(Mesh mesh)
        {
            return mesh == null ? 0 : (int)mesh.GetIndexCount(0) / 3;
        }
    }

    /** Gpu-instanced moving geometry; immutable roads are merged once, not repeated as thousands of objects. */
    public sealed class InstanceBatch : MonoBehaviour
    {
        private Mesh mesh;
        private Material material;
        private readonly List<Matrix4x4> transforms = new List<Matrix4x4>();
        private readonly List<Vector3> restPositions = new List<Vector3>();
        private readonly List<Vector3> motionAxes = new List<Vector3>();
        private readonly Matrix4x4[] batch = new Matrix4x4[1023];
        private float elapsed;
        public void Configure(Mesh sharedMesh, Material sharedMaterial)
        { mesh = sharedMesh; material = sharedMaterial; if (material != null) material.enableInstancing = true; }
        public void Clear() { transforms.Clear(); restPositions.Clear(); motionAxes.Clear(); }
        public void Add(Vector3 position, Quaternion rotation, Vector3 scale)
        { transforms.Add(Matrix4x4.TRS(position, rotation, scale)); restPositions.Add(position); motionAxes.Add(Vector3.zero); }
        public void SetAxis(int index,Vector3 axis){if(index>=0&&index<motionAxes.Count)motionAxes[index]=axis;}
        public int Count {get{return transforms.Count;}}
        public void ReleaseMesh(){if(mesh!=null)Destroy(mesh);mesh=null;}
        public void Animate(float delta)
        {
            elapsed += delta;
            for (var i = 0; i < transforms.Count; i++)
            {
                var t = transforms[i];
                var p = restPositions[i] + motionAxes[i] * (Mathf.Sin(elapsed * .18f + i * 1.9f) * .88f);
                t.SetColumn(3, new Vector4(p.x, p.y, p.z, 1f));
                transforms[i] = t;
            }
        }
        private void LateUpdate()
        {
            if (mesh == null || material == null || transforms.Count == 0) return;
            var start = 0;
            while (start < transforms.Count)
            {
                var count = Math.Min(1023, transforms.Count - start);
                for (var i = 0; i < count; i++) batch[i] = transforms[start + i];
                Graphics.DrawMeshInstanced(mesh, 0, material, batch, count, null, ShadowCastingMode.On, true, 0, null);
                start += count;
            }
        }
    }
}
