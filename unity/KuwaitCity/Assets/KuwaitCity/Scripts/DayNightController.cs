using UnityEngine;
using UnityEngine.Rendering;

namespace KuwaitCity
{
    public sealed class DayNightController : MonoBehaviour
    {
        [SerializeField] private Light sun;
        [SerializeField] private Material windows;
        [SerializeField] private Material lamps;
        public TimeMode Mode {get;private set;} = TimeMode.Auto;
        public float Night {get;private set;}
        private float phase=.16f;
        public void Configure(Light directional, Material windowMaterial, Material lampMaterial = null)
        {sun=directional;windows=windowMaterial;lamps=lampMaterial;sun.shadows=LightShadows.Soft;Apply();}
        public void CycleMode(){Mode=(TimeMode)(((int)Mode+1)%3);phase=.16f;Apply();}
        public void SetMode(TimeMode mode){Mode=mode;Apply();}
        private void Update(){if(Mode==TimeMode.Auto){phase=(phase+Time.deltaTime/110f)%1f;Apply();}}
        private static float Smooth(float a,float b,float v){var t=Mathf.Clamp01((v-a)/(b-a));return t*t*(3-2*t);}
        private void Apply()
        {
            if(sun==null)return;
            var rawHeight=Mode==TimeMode.Day?.8f:Mode==TimeMode.Night?-.6f:Mathf.Sin(phase*Mathf.PI*2);
            Night=1-Smooth(-.12f,.26f,rawHeight);
            var dayColor=new Color32(255,237,199,255);var duskColor=new Color32(255,185,136,255);var nightColor=new Color32(108,153,205,255);
            var warm=Color.Lerp(dayColor,duskColor,Mathf.Clamp01(1-Mathf.Abs(rawHeight)/.34f));sun.color=Color.Lerp(warm,nightColor,Night);sun.intensity=Mathf.Lerp(2.2f,.13f,Night);
            var altitude=Mode==TimeMode.Night?18f:Mathf.Max(7f,Mathf.Asin(Mathf.Max(-.2f,rawHeight))*Mathf.Rad2Deg);sun.transform.rotation=Quaternion.Euler(altitude,phase*360f-70f,0);
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.Lerp(new Color(.52f,.68f,.64f),new Color(.09f,.14f,.22f),Night);
            RenderSettings.fog=true;RenderSettings.fogMode=FogMode.Linear;RenderSettings.fogStartDistance=90;RenderSettings.fogEndDistance=205;
            if(windows!=null){windows.EnableKeyword("_EMISSION");windows.SetColor("_EmissionColor",new Color(1f,.65f,.26f)*(.12f+Night*2.4f));}
            if(lamps!=null){lamps.EnableKeyword("_EMISSION");lamps.SetColor("_EmissionColor",new Color(1f,.69f,.33f)*(.12f+Night*3.4f));}
        }
    }
}
