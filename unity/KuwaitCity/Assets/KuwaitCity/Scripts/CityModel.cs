using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KuwaitCity
{
    public enum BuildingKind { Villa, Modern, Apartments, Shop, Tower, Power, Water, Police, Clinic, School, Fire, Park, Kuwait, Mosque, Liberation, Palace, Boubyan }
    public enum TimeMode { Auto, Day, Night }
    public enum BuildTool { Select, Build, Road, Bulldoze, Zone }

    [Serializable] public struct BuildingDefinition
    {
        public BuildingKind Kind;
        public string ArabicName;
        public int Population,PowerUse,PowerGive,WaterUse,WaterGive,Happiness;
        public float Income;
        public bool NeedsRoad,CoastBoost;
        public int NeedsPopulation;
        public BuildingDefinition(BuildingKind kind,string name,int pop,float income,int pu=0,int pg=0,int wu=0,int wg=0,int happy=0,bool road=true,int needs=0,bool coast=false)
        {
            Kind=kind;ArabicName=name;Population=pop;Income=income;PowerUse=pu;PowerGive=pg;WaterUse=wu;WaterGive=wg;Happiness=happy;NeedsRoad=road;NeedsPopulation=needs;CoastBoost=coast;
        }
    }

    /** Core economy values follow the browser game's single-cell companion model. */
    public static class CityCatalog
    {
        public static readonly BuildingDefinition[] All={
            new(BuildingKind.Villa,"فيلا",12,2.4f,1,0,1,0,1,true,0,true),
            new(BuildingKind.Modern,"فيلا حديثة",16,3.6f,2,0,1,0,2,true,0,true),
            new(BuildingKind.Apartments,"عمارة",34,4.2f,3,0,2,0,0,true,0,true),
            new(BuildingKind.Shop,"محل السوق",0,3.6f,2,0,1,0,2,true,24,true),
            new(BuildingKind.Tower,"برج مكاتب",0,6.5f,4,0,2,0,1,true,70),
            new(BuildingKind.Power,"محطة كهرباء",0,0,0,16,0,0,-7,false),
            new(BuildingKind.Water,"محطة تحلية",0,0,1,0,0,18,-2,false),
            new(BuildingKind.Police,"مركز شرطة",0,0,1,0,0,0,12,false),
            new(BuildingKind.Clinic,"مستوصف",0,0,1,0,1,0,12,false),
            new(BuildingKind.School,"مدرسة",0,0,1,0,1,0,10),
            new(BuildingKind.Fire,"مركز إطفاء",0,0,1,0,1,0,8),
            new(BuildingKind.Park,"حديقة",0,0,0,0,1,0,9,false),
            new(BuildingKind.Kuwait,"أبراج الكويت",0,4.8f,2,0,1,0,18,false,0,true),
            new(BuildingKind.Mosque,"المسجد الكبير",0,1.6f,1,0,1,0,16,false),
            new(BuildingKind.Liberation,"برج التحرير",0,3.8f,2,0,0,0,14,false),
            new(BuildingKind.Palace,"قصر السيف",0,3.1f,2,0,1,0,14,false,0,true),
            new(BuildingKind.Boubyan,"برج بوبيان",0,7.2f,4,0,1,0,12,true,0,true)
        };
        public static BuildingDefinition Get(BuildingKind kind) { return All[(int)kind]; }
    }

    [Serializable] public sealed class BuildingRecord
    {
        public string Id;
        public BuildingKind Kind;
        public int C,R,Level=1;
        public double Stored;
        public float Rotation;
        public BuildingRecord() { }
        public BuildingRecord(BuildingKind kind,int c,int r,int level=1){Id=Guid.NewGuid().ToString("N");Kind=kind;C=c;R=r;Level=level;}
        public BuildingRecord Clone(){return new BuildingRecord{Id=Id,Kind=Kind,C=C,R=R,Level=Level,Stored=Stored,Rotation=Rotation};}
    }

    [Serializable] public sealed class CitySave
    {
        public int Version=1;
        public int Coins=3200;
        public double Day;
        public int Speed=1,Tax=7;
        public bool Started;
        public string[] Roads=Array.Empty<string>();
        public BuildingRecord[] Buildings=Array.Empty<BuildingRecord>();
        public CitySave Clone()
        {
            return new CitySave{Version=Version,Coins=Coins,Day=Day,Speed=Speed,Tax=Tax,Started=Started,Roads=(Roads??Array.Empty<string>()).ToArray(),Buildings=(Buildings??Array.Empty<BuildingRecord>()).Select(b=>b.Clone()).ToArray()};
        }
    }

    public readonly struct CityStats
    {
        public readonly int Population,Happiness,PowerUse,PowerGive,WaterUse,WaterGive;
        public readonly float Multiplier;
        public readonly bool Short;
        public CityStats(int population,int happy,int pu,int pg,int wu,int wg,float multiplier)
        {Population=population;Happiness=happy;PowerUse=pu;PowerGive=pg;WaterUse=wu;WaterGive=wg;Multiplier=multiplier;Short=population>=20&&(pu>pg||wu>wg);}
    }

    public static class CityLand
    {
        public const int Columns=48,Rows=32;
        public const float CellSize=2.2f;
        public static readonly Vector2Int[] Directions={Vector2Int.right,Vector2Int.left,Vector2Int.up,Vector2Int.down};
        private static byte[,] land;
        public static void Initialize(TextAsset asset)
        {
            if(asset==null)throw new ArgumentNullException("mask");
            var text=asset.text.Split(new[]{'\r','\n'},StringSplitOptions.RemoveEmptyEntries);
            if(text.Length!=Rows)throw new ArgumentException("Land mask must have 32 rows.");
            land=new byte[Rows,Columns];
            for(int r=0;r<Rows;r++)
            {
                var line=text[r].Split(new[]{' ',','},StringSplitOptions.RemoveEmptyEntries);
                if(line.Length!=Columns)throw new ArgumentException("Land mask must have 48 columns.");
                for(int c=0;c<Columns;c++)land[r,c]=byte.Parse(line[c]);
            }
        }
        public static void Initialize(string[] rows){Initialize(new TextAsset(string.Join("\n",rows)));}
        public static bool IsLand(int c,int r){return land!=null&&c>=0&&r>=0&&c<Columns&&r<Rows&&land[r,c]==1;}
        public static bool Coastal(int c,int r){return IsLand(c,r)&&Directions.Any(d=> !IsLand(c+d.x,r+d.y));}
        public static Vector3 World(int c,int r){return new Vector3((c-Columns/2f+.5f)*CellSize,.3f,(r-Rows/2f+.5f)*CellSize);}
        public static Vector2Int Cell(Vector3 point){return new Vector2Int(Mathf.FloorToInt(point.x/CellSize+Columns/2f),Mathf.FloorToInt(point.z/CellSize+Rows/2f));}
        public static string Key(int c,int r){return c+","+r;}
        public static bool TryCell(string key,out int c,out int r)
        {c=r=0;var parts=key.Split(',');return parts.Length==2&&int.TryParse(parts[0],out c)&&int.TryParse(parts[1],out r);}
    }

    /** UI-independent core. Changed contains structural/economy actions; simulation progress is read by the host. */
    public sealed class CitySimulation
    {
        private readonly List<BuildingRecord> buildings=new();
        private readonly HashSet<string> roads=new(StringComparer.Ordinal);
        public CitySave State {get;private set;}=new CitySave();
        public IReadOnlyList<BuildingRecord> Buildings {get{return buildings;}}
        public IReadOnlyCollection<string> Roads {get{return roads;}}
        public int CurrentBuildingsCount{get{return buildings.Count;}}
        public int CurrentRoadsCount{get{return roads.Count;}}
        public int Tax{get{return State.Tax;}}
        public int TotalStored{get{return buildings.Sum(b=>Mathf.FloorToInt((float)b.Stored));}}
        public event Action Changed;
        public event Action<string> NotifyMessage;
        public CitySimulation(){}
        public CitySimulation(CitySave saved){Restore(saved);}
        private void NotifyChanged(){if(Changed!=null)Changed();}
        private void Tell(string text){if(NotifyMessage!=null)NotifyMessage(text);}
        public void Start(){State.Started=true;State.Speed=1;NotifyChanged();}
        public void Restore(CitySave saved)
        {
            State=(saved??new CitySave()).Clone();
            roads.Clear();buildings.Clear();
            foreach(var key in State.Roads??Array.Empty<string>())
            if(CityLand.TryCell(key,out var c,out var r)&&CityLand.IsLand(c,r))roads.Add(CityLand.Key(c,r));
            foreach(var record in State.Buildings??Array.Empty<BuildingRecord>())
            {
                if(record==null||!CityLand.IsLand(record.C,record.R)||roads.Contains(CityLand.Key(record.C,record.R)))continue;
                if(buildings.Any(b=>b.C==record.C&&b.R==record.R))continue;
                record.Level=Mathf.Clamp(record.Level,1,3);record.Stored=Math.Max(0,record.Stored);
                if(!Enum.IsDefined(typeof(BuildingKind),record.Kind))continue;
                buildings.Add(record);
            }
            State.Coins=Mathf.Max(-8000,State.Coins);State.Speed=Mathf.Clamp(State.Speed,0,3);State.Tax=Mathf.Clamp(State.Tax,0,300);State.Day=Math.Max(0,State.Day);
        }
        public void LoadSession(CitySave saved){Restore(saved);NotifyChanged();}
        public CitySave Snapshot(){var state=State.Clone();state.Buildings=buildings.Select(b=>b.Clone()).ToArray();state.Roads=roads.OrderBy(k=>k).ToArray();return state;}
        public string Encode(){return JsonUtility.ToJson(Snapshot());}
        public bool DecodeAndRestore(string json,out string message)
        {
            try
            {
                if(string.IsNullOrWhiteSpace(json)){message="لا يوجد حفظ";return false;}
                var save=JsonUtility.FromJson<CitySave>(json);
                if(save==null||save.Version!=1){message="صيغة الحفظ غير متوافقة";return false;}
                LoadSession(save);message="تم استعادة المدينة";return true;
            }
            catch(ArgumentException){message="تعذّر قراءة الحفظ";return false;}
        }
        public void SetSpeed(int speed){State.Speed=Mathf.Clamp(speed,0,3);NotifyChanged();}
        public void SetTax(int value){State.Tax=Mathf.Clamp(value,0,300);NotifyChanged();}
        public bool BesideRoad(int c,int r){return roads.Contains(CityLand.Key(c+1,r))||roads.Contains(CityLand.Key(c-1,r))||roads.Contains(CityLand.Key(c,r+1))||roads.Contains(CityLand.Key(c,r-1));}
        public bool RoadAt(int c,int r){return roads.Contains(CityLand.Key(c,r));}
        public bool PlaceRoad(int c,int r,out string message)
        {
            if(!CityLand.IsLand(c,r)){message="ما ينفع الطريق في البحر";return false;}
            if(roads.Contains(CityLand.Key(c,r))){message="الطريق موجود";return false;}
            if(buildings.Any(b=>b.C==c&&b.R==r)){message="في مبنى هنا";return false;}
            roads.Add(CityLand.Key(c,r));message="تم رصف الطريق";NotifyChanged();return true;
        }
        public bool Place(BuildingKind kind,int c,int r,out string message)
        {
            if(!Enum.IsDefined(typeof(BuildingKind),kind)){message="نوع غير معروف";return false;}
            if(!CityLand.IsLand(c,r)){message="ما ينفع البناء في البحر";return false;}
            if(roads.Contains(CityLand.Key(c,r))||buildings.Any(b=>b.C==c&&b.R==r)){message="الأرض مشغولة";return false;}
            buildings.Add(new BuildingRecord(kind,c,r));message="تم بناء "+CityCatalog.Get(kind).ArabicName;NotifyChanged();return true;
        }
        public bool Bulldoze(int c,int r,out string message)
        {
            var b=buildings.FirstOrDefault(x=>x.C==c&&x.R==r);
            if(b!=null){buildings.Remove(b);message="تم الهدم";NotifyChanged();return true;}
            bool removed=roads.Remove(CityLand.Key(c,r));message=removed?"تمت إزالة الطريق":"لا يوجد مبنى أو طريق هنا";if(removed)NotifyChanged();return removed;
        }
        public bool Upgrade(string id,out string message)
        {
            var b=buildings.FirstOrDefault(x=>x.Id==id);
            if(b==null){message="اختر مبنى أولا";return false;}
            if(b.Level>=3){message="وصل آخر مستوى";return false;}
            b.Level++;if(b.Stored>0)Tell("الدخل المتراكم محفوظ للمبنى المحدث");
            message="ترقية إلى مستوى "+b.Level;NotifyChanged();return true;
        }
        public CityStats Stats()
        {
            int pop=0,pu=0,pg=0,wu=0,wg=0,happy=52;
            foreach(var b in buildings)
            {
                var d=CityCatalog.Get(b.Kind);pop+=d.Population*b.Level*2;pu+=d.PowerUse*b.Level;pg+=Mathf.RoundToInt(d.PowerGive*(1+(b.Level-1)*.45f));wu+=d.WaterUse*b.Level;wg+=Mathf.RoundToInt(d.WaterGive*(1+(b.Level-1)*.45f));happy+=d.Happiness+Math.Sign(d.Happiness)*(b.Level-1)*2;
            }
            if(State.Tax>40)happy-=Math.Min(24,Mathf.RoundToInt((State.Tax-40)/18f));else if(State.Tax>8)happy-=Mathf.RoundToInt((State.Tax-8)*.6f);if(State.Tax<5)happy+=5;
            bool grace=pop<20;if(!grace&&pu>pg)happy-=18;if(!grace&&wu>wg)happy-=14;if(pop>=48&&!buildings.Any(b=>b.Kind==BuildingKind.Police))happy-=10;
            float util=Math.Min(grace||pu==0?1f:(float)pg/pu,grace||wu==0?1f:(float)wg/wu);if(util>=.999f)util=1f;else util=.22f+Mathf.Clamp01(util)*.78f;
            return new CityStats(pop,Mathf.Clamp(happy,6,100),pu,pg,wu,wg,(.64f+Mathf.Clamp(happy,6,100)/100f*.66f)*util);
        }
        public float IncomePerSecond(BuildingRecord b,CityStats stats)
        {
            var d=CityCatalog.Get(b.Kind);if(d.Income<=0||d.NeedsRoad&&!BesideRoad(b.C,b.R))return 0;
            var baseRate=d.Income*(1+(b.Level-1)*.62f);if(d.NeedsPopulation>stats.Population)baseRate*=.35f;if(d.Population>0)baseRate*=2;
            if(d.CoastBoost&&CityLand.Coastal(b.C,b.R))baseRate*=1.15f;if(State.Tax>=32&&(b.Kind==BuildingKind.Shop||b.Kind==BuildingKind.Tower))baseRate*=.9f;
            return baseRate*stats.Multiplier*(.55f+State.Tax/100f*1.2f);
        }
        public void Tick(double seconds)
        {
            if(!State.Started||State.Speed==0||seconds<=0)return;
            seconds=Math.Min(seconds,120);
            var st=Stats();double scaledSeconds=seconds*(State.Speed==1?1:State.Speed==2?4:12);
            foreach(var b in buildings){float rate=IncomePerSecond(b,st);b.Stored=Math.Min(rate*48,b.Stored+rate*scaledSeconds);}
            State.Day+=seconds*(State.Speed==1?6:State.Speed==2?24:72);
        }
        public int CollectAll()
        {int n=buildings.Sum(b=>Mathf.FloorToInt((float)b.Stored));foreach(var b in buildings)b.Stored-=Math.Floor(b.Stored);State.Coins+=n;NotifyChanged();return n;}
        public int Collect(string id,bool notify=false)
        {
            var b=buildings.FirstOrDefault(item=>item.Id==id);if(b==null||b.Stored<1)return 0;
            var n=Mathf.FloorToInt((float)b.Stored);b.Stored-=n;State.Coins+=n;
            if(notify)NotifyChanged();return n;
        }
        public int PlanZone(int c0,int r0,int c1,int r1,bool park)
        {
            if(!State.Started)return 0;
            int x0=Math.Min(c0,c1),x1=Math.Max(c0,c1),y0=Math.Min(r0,r1),y1=Math.Max(r0,r1);
            if(x1-x0<3||y1-y0<3)return 0;
            var changed=false;var queue=new List<int>();
            for(int c=x0;c<=x1;c++)for(int r=y0;r<=y1;r++)
            if((c%4==0||r%4==0)&&CityLand.IsLand(c,r)&&!buildings.Any(b=>b.C==c&&b.R==r))
            {if(roads.Add(CityLand.Key(c,r))){changed=true;continue;} }
            for(int c=x0;c<=x1&&buildings.Count<360;c++)for(int r=y0;r<=y1&&buildings.Count<360;r++)
            {
                if(c%4==0||r%4==0||!CityLand.IsLand(c,r)||roads.Contains(CityLand.Key(c,r))||buildings.Any(b=>b.C==c&&b.R==r))continue;
                var kind= park&&(c+r)%7==0?BuildingKind.Park:((c+r)%5==0?BuildingKind.Apartments:BuildingKind.Villa);
                buildings.Add(new BuildingRecord(kind,c,r));changed=true;
            }
            // All self gathered districts get basic utilities, but do not override a chosen occupied lot.
            AddUtility(BuildingKind.Power,x0,y0,x1,y1);AddUtility(BuildingKind.Water,x0+1,y0,x1,y1);
            if(changed)NotifyChanged();return buildings.Count;
        }
        private void AddUtility(BuildingKind kind,int x0,int y0,int x1,int y1)
        {
            if(buildings.Any(b=>b.Kind==kind))return;
            for(int c=x0;c<=x1;c++)for(int r=y0;r<=y1;r++)if(CityLand.IsLand(c,r)&&!roads.Contains(CityLand.Key(c,r))&&!buildings.Any(b=>b.C==c&&b.R==r)){buildings.Add(new BuildingRecord(kind,c,r));return;}
        }
    }
}
