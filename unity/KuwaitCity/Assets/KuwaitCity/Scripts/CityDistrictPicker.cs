using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace KuwaitCity
{
    /** A modal schematic preview. No writes occur until a district's enter button is selected. */
    public sealed class CityDistrictPicker : MonoBehaviour
    {
        private CityApp city;
        private Font font;
        private RectTransform overlay,diagram;
        private Text explanation,legacyCaption;
        private Button legacy;
        private readonly List<Image> options=new();
        private string selected="yarmouk";
        public bool Visible=>overlay!=null&&overlay.gameObject.activeSelf;
        public void Configure(CityApp app,CityHud hud)
        {
            city=app;font=hud.Font;
            overlay=Panel(hud.Root,new Color(.012f,.058f,.075f,.99f));
            overlay.anchorMin=Vector2.zero;overlay.anchorMax=Vector2.one;overlay.offsetMin=overlay.offsetMax=Vector2.zero;overlay.gameObject.name="Neighborhood selection";
            var heading=Label(overlay,"اختر الحي",30,0,250,900,45);heading.color=new Color(.97f,.88f,.68f);
            Label(overlay,"مخططات لعب مستوحاة من اللوحات، وليست خرائط مساحية",18,0,205,900,39).color=new Color(.83f,.90f,.87f);
            var choice=Panel(overlay,Color.clear);choice.anchoredPosition=new Vector2(0,151);choice.sizeDelta=new Vector2(430,42);
            for(int i=0;i<CityDistricts.Ids.Length;i++)
            {
                string id=CityDistricts.Ids[i];var button=Button(choice,CityDistricts.ArabicName(id),()=>Select(id),-143+i*143,0,137,40);options.Add(button.GetComponent<Image>());
            }
            var card=Panel(overlay,new Color(.07f,.20f,.24f));card.anchoredPosition=new Vector2(0,-19);card.sizeDelta=new Vector2(350,244);
            diagram=Panel(card,Color.clear);diagram.anchoredPosition=Vector2.zero;diagram.sizeDelta=new Vector2(210,176);
            explanation=Label(overlay,"",20,0,-157,900,38);
            Button(overlay,"دخول الحي",Confirm,153,-217,230,45);
            legacy=Button(overlay,"",Legacy,-153,-217,230,45);legacyCaption=legacy.GetComponentInChildren<Text>();legacyCaption.fontSize=18;
            Button(overlay,"عودة / إلغاء",Close,0,-277,180,39);
            selected=CityDistricts.Valid(city.Model.State.District)?city.Model.State.District:"yarmouk";
            Select(selected);legacyCaption.text=city.HasLegacySave?"استئناف مدينة الكويت القديمة":"لا يوجد حفظ قديم";legacy.interactable=city.HasLegacySave;
            overlay.gameObject.SetActive(false);
        }
        private void Select(string id)
        {
            if(!CityDistricts.Valid(id))return;
            selected=id;explanation.text=CityDistricts.Description(id);
            for(int i=0;i<options.Count;i++)options[i].color=CityDistricts.Ids[i]==id?new Color(.10f,.46f,.47f):new Color(.025f,.105f,.145f);
            BuildPreview(CityDistricts.Get(id));
        }
        private void BuildPreview(DistrictDefinition d)
        {
            for(int i=diagram.childCount-1;i>=0;i--)Destroy(diagram.GetChild(i).gameObject);
            // Schematic screen y = row from top of supplied sign, not cadastral north.
            for(int r=18;r<=30;r++)for(int c=29;c<=43;c++)
            {
                if(!CityLand.IsLand(c,r))continue;
                int sector=d.Sector(c,r);bool road=d.Roads.Contains(CityLand.Key(c,r));
                Color color=road?new Color(.18f,.22f,.23f):sector==0?new Color(.31f,.39f,.34f):new Color(.72f,.66f,.49f);
                var image=Panel(diagram,color);image.GetComponent<Image>().raycastTarget=false;image.pivot=image.anchorMin=image.anchorMax=Vector2.zero;image.anchoredPosition=new Vector2((c-29)*13+7,(r-18)*13+7);image.sizeDelta=new Vector2(12,12);
                var parcel=d.ParcelAt(c,r);
                if(parcel!=null&&parcel.C==c&&parcel.R==r)
                {
                    var number=Label(image,CityDistricts.Number(sector),16,0,0,12,12);number.rectTransform.anchorMin=number.rectTransform.anchorMax=new Vector2(.5f,.5f);number.rectTransform.offsetMin=number.rectTransform.offsetMax=Vector2.zero;
                }
            }
        }
        public void Show()
        {
            if(overlay==null)return;
            city.CancelWorldTool();selected=CityDistricts.Valid(city.Model.State.District)?city.Model.State.District:"yarmouk";
            legacy.interactable=city.HasLegacySave;legacyCaption.text=city.HasLegacySave?"استئناف مدينة الكويت القديمة":"لا يوجد حفظ قديم";
            Select(selected);overlay.gameObject.SetActive(true);city.PauseForSelection();
        }
        private void Confirm(){city.EnterDistrict(selected);}
        private void Legacy(){if(city.HasLegacySave)city.EnterLegacy();}
        public void Close(){if(overlay!=null)overlay.gameObject.SetActive(false);city.DismissDistricts();}
        private static RectTransform Panel(Component parent,Color color)
        {
            var obj=new GameObject("Panel",typeof(RectTransform),typeof(CanvasRenderer),typeof(Image));obj.transform.SetParent(parent.transform,false);
            obj.GetComponent<Image>().color=color;var rect=(RectTransform)obj.transform;rect.anchorMin=rect.anchorMax=rect.pivot=new Vector2(.5f,.5f);if(color.a==0)rect.GetComponent<Image>().raycastTarget=false;return rect;
        }
        private Text Label(Component parent,string value,int size,float x,float y,float width,float height)
        {
            var obj=new GameObject("Label",typeof(RectTransform),typeof(CanvasRenderer),typeof(Text));obj.transform.SetParent(parent.transform,false);
            var text=obj.GetComponent<Text>();text.text=value;text.font=font;text.fontSize=size;text.color=Color.white;text.alignment=TextAnchor.MiddleCenter;text.supportRichText=false;text.raycastTarget=false;
            text.rectTransform.anchorMin=text.rectTransform.anchorMax=new Vector2(.5f,.5f);text.rectTransform.anchoredPosition=new Vector2(x,y);text.rectTransform.sizeDelta=new Vector2(width,height);return text;
        }
        private Button Button(Component parent,string value,Action clicked,float x,float y,float width,float height)
        {
            var rect=Panel(parent,new Color(.025f,.105f,.145f));rect.anchoredPosition=new Vector2(x,y);rect.sizeDelta=new Vector2(width,height);
            var button=rect.gameObject.AddComponent<Button>();button.targetGraphic=rect.GetComponent<Image>();button.onClick.AddListener(clicked);Label(rect,value,20,0,0,width,height);return button;
        }
    }

    /** These generated markers are scenery only; their IDs and glyphs never enter a city save. */
    public sealed class CitySectorLabels : MonoBehaviour
    {
        private readonly List<TextMesh> markers=new();
        public void Rebuild(string id,Font font)
        {
            foreach(var marker in markers)if(marker!=null)Destroy(marker.gameObject);
            markers.Clear();if(!CityDistricts.Valid(id)||font==null)return;
            foreach(var parcel in CityDistricts.Get(id).Parcels)
            {
                var obj=new GameObject("Sector "+parcel.Number,typeof(TextMesh));obj.transform.SetParent(transform,false);
                obj.transform.localPosition=CityLand.World(parcel.C,parcel.R)+new Vector3(0,.04f,0);obj.transform.localRotation=Quaternion.Euler(90,0,0);
                var text=obj.GetComponent<TextMesh>();text.text=CityDistricts.Number(parcel.Number);text.font=font;text.fontSize=54;text.characterSize=.07f;text.anchor=TextAnchor.MiddleCenter;text.color=new Color(.09f,.18f,.17f);
                var renderer=obj.GetComponent<MeshRenderer>();if(renderer!=null)renderer.sharedMaterial=font.material;markers.Add(text);
            }
        }
    }
}
