using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KuwaitCity
{
    /** Playable interpretations of the three supplied signs, not survey or cadastral maps. */
    public static class CityDistricts
    {
        public static readonly string[] Ids={"yarmouk","adailiya","surra"};
        public const string LegacySaveKey="omdat-kuwait-unity-v1";
        public const string ActiveSessionKey="omdat-kuwait-unity-active-v1";
        private static readonly Dictionary<string,DistrictDefinition> cache=new(StringComparer.Ordinal);
        public static bool Valid(string id){return Array.IndexOf(Ids,id??"")>=0;}
        public static string SaveKey(string id)
        {
            if(!Valid(id))throw new ArgumentException("Only the three verified neighborhood ids are supported.",nameof(id));
            return "omdat-kuwait-unity-district-"+id+"-v2";
        }
        public static string ArabicName(string id)
        {return id=="yarmouk"?"اليرموك":id=="adailiya"?"العديلية":id=="surra"?"السرة":"مدينة الكويت";}
        public static string Description(string id)
        {return id=="yarmouk"?"طريق رئيسي مائل وتقاطع يفصل القطع الأربع":id=="adailiya"?"شارعان مستقيمان وتقاطع أفقي بين القطع الأربع":"شارع رئيسي متعرج وتقاطعان بين القطع الست";}
        public static string Number(int number){return "٠١٢٣٤٥٦٧٨٩".Substring(number,1);}
        public static CitySave NewCity(string id)
        {var d=Get(id);return new CitySave{Started=true,Speed=0,District=id,Version=2,Coins=3200,Roads=d.Roads.ToArray()};}
        public static DistrictDefinition Get(string id)
        {
            if(!Valid(id))throw new ArgumentException("Unknown neighborhood",nameof(id));
            // The land mask is fixed after bootstrap; this is intentionally reset in test setup.
            if(cache.TryGetValue(id,out var existing))return existing;
            var d=new DistrictDefinition(id,ArabicName(id));
            foreach(var block in Blocks(id))
            {
                var parcel=new DistrictParcel{Number=block[0],Left=block[1]==0,R0=block[2],R1=block[3]};
                for(int r=parcel.R0;r<=parcel.R1;r++)
                {var edge=Main(id,r);int left=parcel.Left?30:edge[1]+1,right=parcel.Left?edge[0]-1:42;
                    for(int c=left;c<=right;c++)if(CityLand.IsLand(c,r))parcel.Cells.Add(new Vector2Int(c,r));}
                if(parcel.Cells.Count==0)throw new InvalidOperationException("A parcel cannot consist of water: "+id+"/"+parcel.Number);
                var marker=parcel.Cells.OrderByDescending(at=>at.y).ThenBy(at=>parcel.Left?at.x:-at.x).First();parcel.C=marker.x;parcel.R=marker.y;
                d.Parcels.Add(parcel);d.MapParcel(parcel);
            }
            AddRoadNetwork(id,d);foreach(var at in d.Roads)d.SchematicRoads.Add(at);cache[id]=d;return d;
        }
        public static void ClearCache(){cache.Clear();}
        public static int[] Main(string id,int r)
        {
            if(id=="yarmouk")return r<22?new[]{35,35}:r<26?new[]{35,36}:r<27?new[]{36,37}:new[]{37,37};
            if(id=="adailiya")return new[]{36,37};
            return r<24?new[]{35,37}:r<29?new[]{36,38}:r==29?new[]{37,38}:new[]{36,38};
        }
        private static IEnumerable<int[]> Blocks(string id)
        {
            if(id=="yarmouk"){yield return new[]{2,0,19,26};yield return new[]{3,1,19,26};yield return new[]{1,0,28,30};yield return new[]{4,1,28,30};}
            else if(id=="adailiya"){yield return new[]{3,0,19,26};yield return new[]{2,1,19,26};yield return new[]{4,0,28,30};yield return new[]{1,1,28,30};}
            else {yield return new[]{1,0,19,22};yield return new[]{2,1,19,22};yield return new[]{6,0,24,27};yield return new[]{3,1,24,27};yield return new[]{5,0,29,31};yield return new[]{4,1,29,31};}
        }
        private static void AddRoadNetwork(string id,DistrictDefinition d)
        {
            // This is source-equivalent to the delivered schematic road generator, including
            // its open gaps between parcels and its explicit two-cell bends at slanted rows.
            for(int r=18;r<=30;r++)for(int c=29;c<=43;c++)
                if(CityLand.IsLand(c,r)&&(c==29||c==43||r==18||!d.Land.Contains(CityLand.Key(c,r))))d.Roads.Add(CityLand.Key(c,r));
            for(int r=18;r<30;r++)foreach(var edge in Main(id,r).Concat(Main(id,r+1)))
                foreach(var at in new[]{new Vector2Int(edge,r),new Vector2Int(edge,r+1)})
                    if(edge>=29&&edge<=43&&CityLand.IsLand(at.x,at.y)&&!d.Land.Contains(CityLand.Key(at.x,at.y)))d.Roads.Add(CityLand.Key(at.x,at.y));
        }
    }
    public sealed class DistrictDefinition
    {
        public readonly string Id,Name;
        public readonly List<DistrictParcel> Parcels=new();
        public readonly HashSet<string> Land=new(StringComparer.Ordinal),Roads=new(StringComparer.Ordinal);
        public readonly HashSet<string> SchematicRoads=new(StringComparer.Ordinal);
        private readonly Dictionary<string,DistrictParcel> parcelCells=new(StringComparer.Ordinal);
        public DistrictDefinition(string id,string name){Id=id;Name=name;}
        internal void MapParcel(DistrictParcel parcel){foreach(var at in parcel.Cells){var key=CityLand.Key(at.x,at.y);Land.Add(key);parcelCells.Add(key,parcel);}}
        public bool Buildable(int c,int r){return Land.Contains(CityLand.Key(c,r));}
        public int Sector(int c,int r){return parcelCells.TryGetValue(CityLand.Key(c,r),out var p)?p.Number:0;}
        public DistrictParcel ParcelAt(int c,int r){parcelCells.TryGetValue(CityLand.Key(c,r),out var p);return p;}
        public Vector3 Center()
        {
            var parcels=Parcels.SelectMany(p=>p.Cells).ToArray();return CityLand.World(36,(parcels.Min(at=>at.y)+parcels.Max(at=>at.y))/2);
        }
    }
    public sealed class DistrictParcel
    {public int Number,C,R,R0,R1;public bool Left;public readonly List<Vector2Int> Cells=new();}
}
