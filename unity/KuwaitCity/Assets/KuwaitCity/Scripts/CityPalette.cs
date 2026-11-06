using UnityEngine;

namespace KuwaitCity
{
    [CreateAssetMenu(menuName="Kuwait City/Gulf Teal & Sand Gold",fileName="GulfPalette")]
    public sealed class CityPalette : ScriptableObject
    {
        public Material limestone,pale,land,sand,asphalt,teal,gold,dark,glass,leaf,windows,water,roadMark;
        public Material PalmMaterial {get{return leaf;}}
        public Material VehicleMaterial {get{return teal;}}
        public static Material NewLit(string title,Color tint,bool instancing=false,float smoothness=.22f)
        {
            var shader=Shader.Find("Universal Render Pipeline/Lit");
            if(shader==null)throw new System.InvalidOperationException("URP Lit shader is missing. Run Kuwait City/Prepare Mobile URP Scene in the Unity editor.");
            var material=new Material(shader){name=title,color=tint,enableInstancing=instancing};
            material.SetFloat("_Surface",0);material.SetFloat("_Smoothness",smoothness);
            return material;
        }
    }
    public static class CityPaletteFactory
    {
        public static CityPalette Populate(CityPalette p)
        {
            p.limestone=CityPalette.NewLit("Limestone",new(.80f,.69f,.50f));
            p.pale=CityPalette.NewLit("Ivory",new(.93f,.88f,.75f));
            p.land=CityPalette.NewLit("Warm city ground",new(.72f,.62f,.45f));
            p.sand=CityPalette.NewLit("Sand Gold",new(.78f,.62f,.37f));
            p.asphalt=CityPalette.NewLit("Asphalt",new(.12f,.17f,.20f));
            p.teal=CityPalette.NewLit("Gulf Teal",new(.035f,.37f,.41f),true);
            p.gold=CityPalette.NewLit("Warm Gold",new(.81f,.60f,.23f),false,.58f);
            p.dark=CityPalette.NewLit("Deep Teal",new(.04f,.16f,.20f));
            p.glass=CityPalette.NewLit("Low poly glass",new(.08f,.32f,.40f),false,.75f);
            p.leaf=CityPalette.NewLit("Instanced leaves",new(.18f,.38f,.23f),true);
            p.water=CityPalette.NewLit("Gulf",new(.025f,.29f,.36f),false,.7f);
            p.roadMark=CityPalette.NewLit("Lane marking",new(.94f,.89f,.75f));
            p.windows=CityPalette.NewLit("Emissive windows",new(.14f,.24f,.28f));
            p.windows.EnableKeyword("_EMISSION");
            p.windows.SetColor("_EmissionColor",new Color(1f,.68f,.32f)*1.7f);
            return p;
        }
    }
}
