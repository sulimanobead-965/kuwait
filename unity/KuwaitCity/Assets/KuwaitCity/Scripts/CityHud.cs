using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace KuwaitCity
{
    /** Touch-sized controls; all graphical panels consume pointer events before world raycasts. */
    public sealed class CityHud : MonoBehaviour
    {
        private CityApp city;
        private CitySimulation model;
        private CityCamera controls;
        private DayNightController daylight;
        private Text metrics,notice,speed,tax,details,lightLabel;
        private Button road,demolish,upgrade,zoomIn,zoomOut;
        private Button[] choices;
        private GameObject welcome,start,selectedPanel;
        private Font font;
        private readonly Color dark=new(.025f,.105f,.145f,.975f),panel=new(.07f,.22f,.26f,.94f),active=new(.045f,.42f,.45f),sand=new(.98f,.87f,.65f),ink=new(.97f,.96f,.87f);
        public RectTransform Root{get;private set;}
        public void Configure(CityApp app,CityCamera camera,DayNightController night)
        {
            city=app;model=app.Model;controls=camera;daylight=night;
            font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var events=new GameObject("UI input EventSystem",typeof(EventSystem));events.transform.SetParent(transform,false);
#if ENABLE_INPUT_SYSTEM
            events.AddComponent<InputSystemUIInputModule>();
#else
            events.AddComponent<StandaloneInputModule>();
#endif
            var c=new GameObject("Arabic Touch UI",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));c.transform.SetParent(transform,false);Root=(RectTransform)c.transform;
            c.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;
            var scale=c.GetComponent<CanvasScaler>();scale.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scale.referenceResolution=new Vector2(960,600);scale.matchWidthOrHeight=.35f;
            var top=Panel(Root,dark);top.anchorMin=new Vector2(0,1);top.anchorMax=new Vector2(1,1);top.pivot=new Vector2(.5f,1);top.sizeDelta=new Vector2(0,49);
            metrics=Text(top,"",19,sand,Vector2.zero,Vector2.zero);Stretch(metrics.rectTransform,8,2,-390,-2);
            lightLabel=Button(top,"تلقائي",Mode,-211,-7,92,33).GetComponentInChildren<Text>();AnchorTopRight(lightLabel.rectTransform.parent.GetComponent<RectTransform>(),1,1,8,-8);
            speed=Button(top,"×1",Speed,-113,-7,80,33).GetComponentInChildren<Text>();AnchorTopRight(speed.rectTransform.parent.GetComponent<RectTransform>(),1,1,105,-8);
            var sidebar=Panel(Root,panel);sidebar.anchorMin=new Vector2(0,1);sidebar.anchorMax=new Vector2(0,1);sidebar.anchoredPosition=new Vector2(68,-166);sidebar.sizeDelta=new Vector2(126,246);
            road=Button(sidebar,"طريق",()=>city.SetTool(BuildTool.Road),3,-7,111,31);
            demolish=Button(sidebar,"هدم",()=>city.SetTool(BuildTool.Bulldoze),3,-45,111,31);
            Button(sidebar,"اختيار",()=>city.SetTool(BuildTool.Select),3,-83,111,31);
            tax=Button(sidebar,"الضريبة ٧٪",Tax,3,-121,111,46).GetComponentInChildren<Text>();
            Button(sidebar,"حفظ المدينة",city.SaveCity,3,-173,111,29);
            Button(sidebar,"مدينة جديدة",city.RequestNewCity,3,-207,111,32);
            var selection=Panel(Root,panel);selection.anchorMin=selection.anchorMax=new Vector2(1,1);selection.pivot=new Vector2(1,1);selection.anchoredPosition=new Vector2(-5,-100);selection.sizeDelta=new Vector2(156,209);selectedPanel=selection.gameObject;
            details=Text(selectedPanel.GetComponent<RectTransform>(),"",17,sand,new Vector2(6,5),new Vector2(-6,-102));
            zoomIn=Button(selectedPanel.GetComponent<RectTransform>(),"+",()=>controls.Zoom(1.18f),5,-111,68,40);
            zoomOut=Button(selectedPanel.GetComponent<RectTransform>(),"−",()=>controls.Zoom(.85f),80,-111,65,40);
            Button(selectedPanel.GetComponent<RectTransform>(),"تنسيق حي",city.ActivateZone,5,-157,140,36);
            var lower=Panel(Root,dark);lower.anchorMin=new Vector2(0,0);lower.anchorMax=new Vector2(1,0);lower.pivot=new Vector2(.5f,0);lower.sizeDelta=new Vector2(0,177);
            notice=Text(lower,"لمسة: بناء وتحديد · سحب: كاميرا · قرصتان: زوم",16,sand,new Vector2(141,139),new Vector2(-130,-8));
            var viewport=Panel(lower,new Color(.035f,.18f,.215f));viewport.anchorMin=Vector2.zero;viewport.anchorMax=Vector2.one;viewport.offsetMin=new Vector2(5,5);viewport.offsetMax=new Vector2(-5,-51);ViewportMask(viewport.gameObject);
            var data=new GameObject("Seventeen building catalogue",typeof(RectTransform));data.transform.SetParent(viewport,false);var content=(RectTransform)data.transform;content.anchorMin=new Vector2(0,1);content.anchorMax=new Vector2(1,1);content.pivot=new Vector2(0,1);content.offsetMin=new Vector2(0,0);content.offsetMax=new Vector2(0,0);content.sizeDelta=new Vector2(0,110);
            var scroll=viewport.gameObject.AddComponent<ScrollRect>();scroll.horizontal=true;scroll.vertical=false;scroll.viewport=viewport;scroll.content=content;scroll.inertia=true;scroll.decelerationRate=.35f;scroll.scrollSensitivity=20;
            var layout=data.AddComponent<HorizontalLayoutGroup>();layout.padding=new RectOffset(10,10,5,5);layout.spacing=8;layout.childAlignment=TextAnchor.MiddleLeft;layout.childControlWidth=false;layout.childForceExpandWidth=false;
            choices=new Button[CityCatalog.All.Length];
            for(int i=0;i<CityCatalog.All.Length;i++)
            {
                int n=i;var b=Button(content,CityCatalog.All[i].ArabicName,()=>city.SetBuilding(n),0,0,145,108);
                b.gameObject.AddComponent<LayoutElement>().preferredWidth=145;choices[i]=b;
            }
            Button(lower,"جمع الدخل",city.Collect,14,-139,128,31);
            upgrade=Button(lower,"ترقية المحدد",city.UpgradeSelected,149,-139,129,31);
            Button(lower,"حي تلقائي",city.ActivateZone,285,-139,133,31);
            var hint=Text(Root,"Original volumetric city",13,sand,new Vector2(140,2),new Vector2(-140,28));hint.raycastTarget=false;
            var welcomeText=Text(Root,"عمدة الكويت\nمدينة خليجية ثلاثية الأبعاد",38,sand,new Vector2(210,140),new Vector2(-210,60));welcomeText.rectTransform.anchorMin=new Vector2(.5f,.64f);welcomeText.rectTransform.anchorMax=new Vector2(.5f,.64f);welcomeText.raycastTarget=false;welcome=welcomeText.gameObject;
            var play=Button(Root,"ابدأ مدينتك",city.StartGame,0,0,186,65);start=play.gameObject;var playRect=(RectTransform)play.transform;playRect.anchorMin=playRect.anchorMax=new Vector2(.5f,.53f);playRect.anchoredPosition=Vector2.zero;play.GetComponentInChildren<Text>().fontSize=25;
        }
        private void Update()
        {
            if(city==null||model==null)return;
            var st=model.Stats();
            metrics.text=$"د.ك {model.State.Coins}   سكان {st.Population}   رضا {st.Happiness}%   كهرباء {st.PowerUse}/{st.PowerGive}   ماء {st.WaterUse}/{st.WaterGive}";
            notice.text=city.Message;speed.text=model.State.Speed==0?"وقف":$"×{model.State.Speed}";tax.text=$"الضريبة {model.State.Tax}٪";
            welcome.SetActive(!model.State.Started);start.SetActive(!model.State.Started);
            details.text=city.SelectedDescription();upgrade.interactable=!string.IsNullOrEmpty(city.SelectedId);
            road.GetComponent<Image>().color=city.SelectedTool==BuildTool.Road?active:dark;demolish.GetComponent<Image>().color=city.SelectedTool==BuildTool.Bulldoze?active:dark;
            for(int i=0;i<choices.Length;i++)choices[i].GetComponent<Image>().color=i==city.ChosenBuilding&&city.SelectedTool==BuildTool.Build?active:dark;
        }
        private void Speed(){model.SetSpeed((model.State.Speed+1)%4);city.RefreshScene();}
        private void Tax(){model.SetTax(model.Tax>=40?7:model.Tax>=12?40:12);city.RefreshScene();}
        private void Mode(){daylight.CycleMode();lightLabel.text=daylight.Mode==TimeMode.Auto?"تلقائي":daylight.Mode==TimeMode.Day?"نهار":"ليل";}
        private static void AnchorTopRight(RectTransform t,float x,float y,float ox,float oy){t.anchorMin=new Vector2(x,y);t.anchorMax=new Vector2(x,y);t.anchoredPosition=new Vector2(ox,oy);}
        private void ViewportMask(GameObject o){o.AddComponent<Mask>().showMaskGraphic=false;}
        private RectTransform Panel(Component parent,Color tint)
        {
            var obj=new GameObject("Panel",typeof(RectTransform),typeof(CanvasRenderer),typeof(Image));obj.transform.SetParent(parent.transform,false);obj.GetComponent<Image>().color=tint;return (RectTransform)obj.transform;
        }
        private static void Stretch(RectTransform t,float left,float bottom,float right,float top){t.anchorMin=Vector2.zero;t.anchorMax=Vector2.one;t.offsetMin=new Vector2(left,bottom);t.offsetMax=new Vector2(right,top);}
        private Text Text(Component parent,string value,int size,Color color,Vector2 offsetMin,Vector2 offsetMax)
        {
            var obj=new GameObject(value,typeof(RectTransform),typeof(CanvasRenderer),typeof(Text));obj.transform.SetParent(parent.transform,false);
            var text=obj.GetComponent<Text>();text.font=font;text.fontSize=size;text.text=value;text.alignment=TextAnchor.MiddleCenter;text.color=color;text.raycastTarget=false;text.supportRichText=false;
            text.rectTransform.anchorMin=Vector2.zero;text.rectTransform.anchorMax=Vector2.one;text.rectTransform.offsetMin=offsetMin;text.rectTransform.offsetMax=offsetMax;
            return text;
        }
        private Button Button(Component parent,string label,Action clicked,float x,float y,float width,float height)
        {
            var t=Panel(parent,dark);t.anchorMin=t.anchorMax=new Vector2(0,1);t.pivot=new Vector2(0,1);t.anchoredPosition=new Vector2(x,y);t.sizeDelta=new Vector2(width,height);
            var b=t.gameObject.AddComponent<Button>();b.targetGraphic=t.GetComponent<Image>();if(clicked!=null)b.onClick.AddListener(clicked.Invoke);
            var cap=Text(b,label,Mathf.Clamp(Mathf.RoundToInt(height*.35f),12,28),ink,Vector2.zero,Vector2.zero);cap.alignment=TextAnchor.MiddleCenter;
            return b;
        }
        public void ShowResetConfirmation(Action yes)
        {
            var dialog=Panel(Root,new Color(.01f,.08f,.10f,.98f));dialog.anchorMin=Vector2.zero;dialog.anchorMax=Vector2.one;dialog.offsetMin=dialog.offsetMax=Vector2.zero;
            var prompt=Text(dialog,"بدء مدينة جديدة؟\nسيُستبدل حفظ الهاتف على هذا الجهاز.\nحفظ لعبة الويب لا يتأثر.",29,sand,new Vector2(170,175),new Vector2(-170,-170));prompt.rectTransform.anchorMin=new Vector2(.5f,.58f);prompt.rectTransform.anchorMax=new Vector2(.5f,.58f);
            var confirm=Button(dialog,"نعم، مدينة جديدة",()=>{yes();Destroy(dialog.gameObject);},0,0,240,61);var transform=(RectTransform)confirm.transform;transform.anchorMin=transform.anchorMax=new Vector2(.37f,.40f);transform.pivot=Vector2.zero;transform.anchoredPosition=Vector2.zero;
            var cancel=Button(dialog,"إلغاء",()=>Destroy(dialog.gameObject),0,0,128,61);transform=(RectTransform)cancel.transform;transform.anchorMin=transform.anchorMax=new Vector2(.68f,.40f);transform.pivot=Vector2.zero;transform.anchoredPosition=Vector2.zero;
        }
    }
}
