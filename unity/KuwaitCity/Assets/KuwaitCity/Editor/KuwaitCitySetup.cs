using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace KuwaitCity.Editor
{
    /** Reproducible supported editor creation; generates no paid or downloaded third party assets. */
    public static class KuwaitCitySetup
    {
        private const string Root="Assets/KuwaitCity";
        [MenuItem("Kuwait City/Prepare Mobile URP Scene")]
        public static void PrepareScene()
        {
            Directory.CreateDirectory(Root+"/Scenes");
            Directory.CreateDirectory(Root+"/Resources/Materials");
            Directory.CreateDirectory(Root+"/Rendering");
            var shader=Shader.Find("Universal Render Pipeline/Lit");
            if(shader==null)
            {
                Debug.LogError("Resolve URP from Packages/manifest.json, then run this setup again.");return;
            }
            var pipelinePath=Root+"/Rendering/Mobile URP.asset";
            var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if(pipeline==null)
            {
                pipeline=UniversalRenderPipelineAsset.Create();
                pipeline.name="Kuwait mobile URP";
                AssetDatabase.CreateAsset(pipeline,pipelinePath);
            }
            GraphicsSettings.currentRenderPipeline=pipeline;
            QualitySettings.renderPipeline=pipeline;
            QualitySettings.shadows=ShadowQuality.All;
            QualitySettings.shadowResolution=ShadowResolution.Medium;
            QualitySettings.vSyncCount=0;
            Application.targetFrameRate=60;
            var palette=AssetDatabase.LoadAssetAtPath<CityPalette>(Root+"/Resources/GulfPalette.asset");
            if(palette==null)
            {
                palette=ScriptableObject.CreateInstance<CityPalette>();
                palette.name="GulfPalette";CityPaletteFactory.Populate(palette);
                AssetDatabase.CreateAsset(palette,Root+"/Resources/GulfPalette.asset");
            }
            foreach(var material in new[]{palette.limestone,palette.pale,palette.land,palette.sand,palette.asphalt,palette.glass,palette.water,palette.dark,palette.teal,palette.gold,palette.leaf,palette.windows,palette.roadMark})
            {
                if(material==null)continue;
                var path=Root+"/Resources/Materials/"+material.name+".mat";
                if(AssetDatabase.GetMainAssetTypeAtPath(path)==null)AssetDatabase.CreateAsset(material,path);
                else AssetDatabase.AddObjectToAsset(material,palette);
            }
            EditorUtility.SetDirty(palette);AssetDatabase.SetLabels(palette,new[]{"GulfPalette"});
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var root=new GameObject("Kuwait City");
            var bootstrap=root.AddComponent<CityBootstrap>();
            var mask=AssetDatabase.LoadAssetAtPath<TextAsset>(Root+"/Resources/kuwait-land.txt");
            var app=root.AddComponent<CityApp>();
            var fields=new SerializedObject(app);
            fields.FindProperty("maskFromScene").objectReferenceValue=mask;fields.ApplyModifiedPropertiesWithoutUndo();
            bootstrap.SetSceneAssets(palette,mask);
            EditorUtility.SetDirty(bootstrap);
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(Root+"/Scenes/City.unity",true)};
            EditorSceneManager.SaveScene(scene,Root+"/Scenes/City.unity");
            AssetDatabase.SaveAssets();AssetDatabase.Refresh();
            Selection.activeGameObject=root;
            EditorUtility.DisplayDialog("Kuwait City","Created the URP scene, materials, land mask and bootstrap. Open City.unity and press Play.\n\nSoft realtime shadows are enabled by this setup. Baked lightmaps and mobile profiling remain separate editor tasks.","OK");
        }
    }
}
