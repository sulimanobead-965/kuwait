using NUnit.Framework;
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KuwaitCity.Tests
{
    public sealed class KuwaitCityEditModeTests
    {
        private CitySimulation city;
        [OneTimeSetUp]
        public void Land()
        {
            var rows=new string[CityLand.Rows];
            for(var r=0;r<rows.Length;r++)rows[r]=string.Join(" ",Enumerable.Repeat("1",CityLand.Columns));
            CityLand.Initialize(rows);
        }
        [SetUp] public void NewCity(){city=new CitySimulation();city.Start();city.State.Coins=0;}
        [Test] public void LandCoastAndRoundTrip(){Assert.IsTrue(CityLand.IsLand(12,12));Assert.IsTrue(CityLand.Coastal(0,12));Assert.IsFalse(CityLand.Coastal(12,12));Assert.AreEqual(new Vector2Int(12,12),CityLand.Cell(CityLand.World(12,12)));}
        [Test] public void OccupiedLotsAndRoadsAreSeparate()
        {
            Assert.IsTrue(city.PlaceRoad(10,10,out _));Assert.IsFalse(city.PlaceRoad(10,10,out _));
            Assert.IsFalse(city.Place(BuildingKind.Villa,10,10,out _));
            Assert.IsTrue(city.Place(BuildingKind.Villa,10,11,out _));Assert.IsFalse(city.Place(BuildingKind.Shop,10,11,out _));
            Assert.IsFalse(city.Place(BuildingKind.Villa,-1,12,out _));
            Assert.IsFalse(city.PlaceRoad(10,11,out _));
        }
        [Test] public void RoadAdjacencyDrivesIncome()
        {
            city.Place(BuildingKind.Villa,10,11,out _);var b=city.Buildings.Single();
            Assert.AreEqual(0f,city.IncomePerSecond(b,city.Stats()));
            city.PlaceRoad(10,10,out _);Assert.Greater(city.IncomePerSecond(b,city.Stats()),0);
            city.Tick(2);Assert.Greater(b.Stored,0);var income=city.CollectAll();Assert.Greater(income,0);Assert.AreEqual(income,city.State.Coins);Assert.Less(b.Stored,1);
        }
        [Test] public void UpgradeLevelsOneToThreeOnly()
        {
            city.Place(BuildingKind.Villa,10,11,out _);var b=city.Buildings.Single();
            Assert.IsTrue(city.Upgrade(b.Id,out _));Assert.IsTrue(city.Upgrade(b.Id,out _));Assert.AreEqual(3,b.Level);Assert.IsFalse(city.Upgrade(b.Id,out _));
        }
        [Test] public void UtilityGraceEndsWithLargerCity()
        {
            city.Place(BuildingKind.Villa,10,11,out _);Assert.IsFalse(city.Stats().Short);
            for(var c=0;c<6;c++)city.Place(BuildingKind.Apartments,c+3,14,out _);
            Assert.IsTrue(city.Stats().Short);city.Place(BuildingKind.Power,20,20,out _);city.Place(BuildingKind.Water,21,20,out _);Assert.IsFalse(city.Stats().Short);
        }
        [Test] public void CoastalLotsReceiveBonus()
        {
            city.Place(BuildingKind.Power,0,22,out _);city.Place(BuildingKind.Water,0,24,out _);
            city.Place(BuildingKind.Kuwait,0,12,out _);city.Place(BuildingKind.Kuwait,12,12,out _);
            Assert.IsTrue(CityLand.Coastal(0,12));Assert.IsFalse(CityLand.Coastal(12,12));
            Assert.Greater(city.IncomePerSecond(city.Buildings[2],city.Stats()),city.IncomePerSecond(city.Buildings[3],city.Stats()));
        }
        [Test] public void SaveIsVersionedRestorableAndDeepIndependent()
        {
            city.PlaceRoad(10,10,out _);city.Place(BuildingKind.Villa,10,11,out _);city.Buildings[0].Stored=3.5;
            var encoded=city.Encode();var restored=new CitySimulation();Assert.IsTrue(restored.DecodeAndRestore(encoded,out _));
            Assert.AreEqual(1,restored.Buildings.Count);Assert.AreEqual(3.5,restored.Buildings[0].Stored);
            city.Buildings[0].Stored=9;Assert.AreEqual(3.5,restored.Buildings[0].Stored);
            Assert.IsFalse(restored.DecodeAndRestore("{\"Version\":999}",out _));Assert.IsFalse(restored.DecodeAndRestore("",out _));
        }
        [Test] public void DayNightCycleTransitionsToNight()
        {
            var host=new GameObject("Test daylight");var light=host.AddComponent<Light>();var controller=host.AddComponent<DayNightController>();controller.Configure(light,null);
            controller.SetMode(TimeMode.Night);Assert.AreEqual(TimeMode.Night,controller.Mode);Assert.AreEqual(1f,controller.Night,.001f);
            controller.CycleMode();Assert.AreEqual(TimeMode.Auto,controller.Mode);
            UnityEngine.Object.DestroyImmediate(host);
        }
        [Test] public void ReferenceArchitectureAndItsDetailTiersStayVolumetric()
        {
            var shell=Primitive.BoubyanTower(3.65f,20,6,out var baseCenter,out var crownCenter);
            Assert.AreEqual(.54f,baseCenter.y,.001f);Assert.Greater(crownCenter.y,baseCenter.y+2f);
            Assert.Greater(shell.GetIndexCount(0),0);UnityEngine.Object.DestroyImmediate(shell);
            var lower=Primitive.BoubyanPoint(0,0,3.65f);var upper=Primitive.BoubyanPoint(1,0,3.65f);
            Assert.Less(Mathf.Abs(upper.x-.14f),Mathf.Abs(lower.x+.04f));
            Assert.Greater(Primitive.BoubyanPoint(1,0,3.65f).y,Primitive.BoubyanPoint(1,Mathf.PI,3.65f).y);
            var palette=ScriptableObject.CreateInstance<CityPalette>();CityPaletteFactory.Populate(palette);
            for(int lod=0;lod<3;lod++)
            {
                var villa=new ModelBaker(palette,lod).Bake(BuildingKind.Villa,1);
                var boubyan=new ModelBaker(palette,lod).Bake(BuildingKind.Boubyan,1);
                Assert.IsTrue(villa.ContainsKey(palette.wood));Assert.IsTrue(villa.ContainsKey(palette.water));
                Assert.IsTrue(boubyan.ContainsKey(palette.silver));Assert.Greater(MeshCosts.Triangles(boubyan),100);
                MeshCosts.Release(villa);MeshCosts.Release(boubyan);
            }
            UnityEngine.Object.DestroyImmediate(palette);
        }
        [Test] public void AllSeventeenBuildingsHaveThreeRealMeshLevels()
        {
            var palette=ScriptableObject.CreateInstance<CityPalette>();CityPaletteFactory.Populate(palette);
            foreach(BuildingKind kind in Enum.GetValues(typeof(BuildingKind)))
            {
                var high=new ModelBaker(palette,0).Bake(kind,1);var mid=new ModelBaker(palette,1).Bake(kind,1);var low=new ModelBaker(palette,2).Bake(kind,1);
                Assert.Greater(MeshCosts.Triangles(high),0,kind.ToString());Assert.Greater(MeshCosts.Triangles(low),0,kind.ToString());
                Assert.GreaterOrEqual(MeshCosts.Triangles(high),MeshCosts.Triangles(mid),kind.ToString());Assert.GreaterOrEqual(MeshCosts.Triangles(mid),MeshCosts.Triangles(low),kind.ToString());
                MeshCosts.Release(high);MeshCosts.Release(mid);MeshCosts.Release(low);
            }
            UnityEngine.Object.DestroyImmediate(palette);
        }
    }
}

namespace KuwaitCity.Tests
{
    /** Source-level tests for the supplied sign layouts, not GIS or survey fixtures. */
    public sealed class KuwaitDistrictTests
    {
        [SetUp] public void LoadActualMask(){CityLand.Initialize(Resources.Load<TextAsset>("kuwait-land"));CityDistricts.ClearCache();}
        [OneTimeTearDown] public void RestoreTestLand(){new KuwaitCityEditModeTests().Land();CityDistricts.ClearCache();}
        [Test] public void OnlyThreeVerifiedLayoutsAndTheExactSignNumberingExist()
        {
            Assert.AreEqual(3,CityDistricts.Ids.Length);
            foreach(var definition in new[]{CityDistricts.Get("yarmouk"),CityDistricts.Get("adailiya"),CityDistricts.Get("surra")})
            {
                int[] expected=definition.Id=="surra"?new[]{1,2,6,3,5,4}:new[]{definition.Id=="yarmouk"?2:3,definition.Id=="yarmouk"?3:2,definition.Id=="yarmouk"?1:4,definition.Id=="yarmouk"?4:1};
                CollectionAssert.AreEqual(expected,definition.Parcels.Select(p=>p.Number).ToArray());
                foreach(var parcel in definition.Parcels)
                {
                    Assert.Greater(parcel.Cells.Count,0);
                    Assert.AreEqual(parcel.Number,definition.Sector(parcel.C,parcel.R));
                    Assert.IsTrue(parcel.Cells.All(at=>CityLand.IsLand(at.x,at.y)));
                    Assert.AreEqual(CityDistricts.Number(parcel.Number),CityDistricts.Number(definition.Sector(parcel.C,parcel.R)));
                }
                Assert.AreEqual(definition.Land.Count,definition.Parcels.Sum(p=>p.Cells.Count));
            }
            Assert.IsFalse(CityDistricts.Valid("jahra"));
        }
        [Test] public void EveryMainArterialAndDividerIsStraightInThePlayableRoads()
        {
            foreach(string id in CityDistricts.Ids)
            {
                var district=CityDistricts.Get(id);
                for(int r=18;r<=30;r++)
                {
                    Assert.AreEqual(36,CityDistricts.Main(id,r)[0]);Assert.AreEqual(37,CityDistricts.Main(id,r)[1]);
                    Assert.IsTrue(district.Roads.Contains(CityLand.Key(36,r))&&district.Roads.Contains(CityLand.Key(37,r)));
                    Assert.AreEqual(0,district.Sector(36,r));Assert.AreEqual(0,district.Sector(37,r));
                }
                foreach(int separator in id=="surra"?new[]{23,28}:new[]{27})
                for(int c=30;c<=42;c++)if(CityLand.IsLand(c,separator)){Assert.IsTrue(district.Roads.Contains(CityLand.Key(c,separator)),id+" "+c+","+separator);Assert.AreEqual(0,district.Sector(c,separator));}
            }
        }
        [Test] public void EveryDistrictHasConnectedAsphaltOutsideEachBuildableParcel()
        {
            foreach(string id in CityDistricts.Ids)
            {
                var district=CityDistricts.Get(id);var seen=new HashSet<string>{"29,18"};var queue=new Queue<string>(new[]{"29,18"});
                Assert.IsTrue(district.Roads.Contains("29,18"),id);
                while(queue.Count>0)
                {
                    CityLand.TryCell(queue.Dequeue(),out var c,out var r);
                    foreach(Vector2Int d in CityLand.Directions){string key=CityLand.Key(c+d.x,r+d.y);if(district.Roads.Contains(key)&&seen.Add(key))queue.Enqueue(key);}
                }
                Assert.AreEqual(district.Roads.Count,seen.Count,id);
                foreach(string road in district.Roads){Assert.IsFalse(district.Land.Contains(road));CityLand.TryCell(road,out var c,out var r);Assert.IsTrue(CityLand.IsLand(c,r));}
            }
        }
        [Test] public void EverySectorCanBeBuiltAndSchematicRoadsAreProtected()
        {
            foreach(string id in CityDistricts.Ids)
            {
                var city=new CitySimulation(CityDistricts.NewCity(id));Assert.AreEqual(2,city.State.Version);var district=CityDistricts.Get(id);
                foreach(var parcel in district.Parcels)Assert.IsTrue(city.Place(BuildingKind.Villa,parcel.C,parcel.R,out _),id+"/"+parcel.Number);
                Assert.IsFalse(city.PlaceRoad(parcelC(id),parcelR(id),out _), "A road cannot enter a numbered lot.");
                var editable="24,19";
                Assert.IsTrue(CityLand.TryCell(editable,out var c,out var r));Assert.IsTrue(CityLand.IsLand(c,r));
                Assert.IsFalse(city.RoadAt(c,r));Assert.IsTrue(city.PlaceRoad(c,r,out _),id+"/ add side road");Assert.IsTrue(city.Bulldoze(c,r,out _),id+"/ remove side road");
                var central=new[]{MainC(id),MainC(id)+1}.First(c=>district.SchematicRoads.Contains(CityLand.Key(c,20)));
                Assert.IsFalse(city.Bulldoze(central,20,out _),id+"/ protected schematic road");
                Assert.IsFalse(city.Place(BuildingKind.Villa,24,19,out _),id+"/ outside numbered lots");
            }
        }
        private static int parcelC(string id)=>CityDistricts.Get(id).Parcels[0].C;
        private static int parcelR(string id)=>CityDistricts.Get(id).Parcels[0].R;
        private static int MainC(string id)=>CityDistricts.Main(id,20)[0];
        [Test] public void PaintOnlyMarksRoadInteriorsAndGivesApproachStops()
        {
            var roads=new HashSet<string>{"22,21","23,21","24,21","25,21","26,21","27,21","25,18","25,20","25,22","25,23"};
            Assert.AreEqual(0,RoadPaintLayout.At(roads,25,21).Count);
            var dash=RoadPaintLayout.At(roads,23,21).Single();Assert.AreEqual(RoadPaintKind.Dash,dash.Kind);
            var approaching=RoadPaintLayout.At(roads,26,21);Assert.IsTrue(approaching.Any(mark=>mark.Kind==RoadPaintKind.Stop&&mark.DC==-1&&mark.DR==0));
            Assert.IsFalse(RoadPaintLayout.At(roads,25,21).Any(mark=>mark.Kind==RoadPaintKind.Dash));
            foreach(string id in CityDistricts.Ids)
            {
                var district=CityDistricts.Get(id);Assert.IsTrue(district.Roads.Any(key=>{CityLand.TryCell(key,out var c,out var r);return RoadPaintLayout.At(district.Roads,c,r).Count>0;}));
                foreach(string key in district.Roads)
                {
                    CityLand.TryCell(key,out var c,out var r);Assert.IsFalse(district.Land.Contains(key));
                    foreach(var mark in RoadPaintLayout.At(district.Roads,c,r))Assert.AreEqual(c,mark.C);
                }
            }
        }
        [Test] public void AutomaticPlanningStaysWithinTheSelectedParcel()
        {
            var city=new CitySimulation(CityDistricts.NewCity("yarmouk"));var parcel=CityDistricts.Get("yarmouk").Parcels[0];
            city.PlanZone(parcel.C,parcel.R,parcel.C+10,parcel.R+5,true);
            Assert.Greater(city.Buildings.Count,0);
            Assert.IsTrue(city.Buildings.All(b=>CityDistricts.Get("yarmouk").Sector(b.C,b.R)==parcel.Number));
        }
        [Test] public void LegacySaveFieldRemainsAbsentAndVersionOneIsReadable()
        {
            Assert.IsTrue(CityLand.IsLand(24,19));Assert.IsFalse(CityDistricts.Get("yarmouk").Land.Contains("24,19"));
            var old=new CitySave{Version=1,Started=true,District=null,Roads=new[]{"24,19"},Buildings=new[]{new BuildingRecord(BuildingKind.Villa,25,19){Id="old-house"}}};
            var clone=old.Clone();Assert.IsNull(clone.District);Assert.AreEqual(1,old.Version);Assert.AreEqual(2,clone.Version);
            Assert.AreEqual("old-house",clone.Buildings[0].Id);
            // This literal is the native v1 format: numeric enum and no District field.
            var data="{\"Version\":1,\"Coins\":3200,\"Day\":0,\"Speed\":1,\"Tax\":7,\"Started\":true,\"Roads\":[\"24,19\"],\"Buildings\":[{\"Id\":\"old-house\",\"Kind\":0,\"C\":25,\"R\":19,\"Level\":1,\"Stored\":0,\"Rotation\":0}]}";Assert.IsFalse(data.Contains("District"));
            var city=new CitySimulation();Assert.IsTrue(city.DecodeAndRestore(data,out var decoded),decoded);Assert.IsNull(city.State.District);
            Assert.AreEqual("old-house",city.Buildings.Single().Id);Assert.AreEqual(2,city.State.Version);
        }
        [Test] public void SwitchingOwnsItsKeyResumesBuildingsAndDoesNotCreateAnythingWhileBrowsing()
        {
            var values=new Dictionary<string,string>();int writes=0;
            var store=MemoryStore(values,()=>writes++);
            var current=new CitySimulation();Assert.IsTrue(store.RestoreInitial(current,out _));Assert.AreEqual(0,writes);
            for(var i=0;i<3;i++)Assert.IsTrue(store.TryRead(CityDistricts.Ids[i],out var preview)&&preview==null);
            Assert.IsTrue(store.Choose("surra",current,out _));int afterChoose=writes;
            Assert.AreEqual("surra",current.State.District);Assert.AreEqual(0,current.State.Speed);Assert.IsTrue(current.State.Started);
            var parcel=CityDistricts.Get("surra").Parcels[0];Assert.IsTrue(current.Place(BuildingKind.Villa,parcel.C,parcel.R,out _));string originalBuildingId=current.Buildings[0].Id;
            store.SaveCurrent(current);Assert.IsFalse(values.ContainsKey(CityDistricts.LegacySaveKey));
            Assert.IsTrue(store.Choose("yarmouk",current,out _));Assert.AreEqual(0,current.Buildings.Count);Assert.AreEqual(0,current.State.Speed);
            Assert.IsTrue(store.Choose("surra",current,out _));Assert.AreEqual(originalBuildingId,current.Buildings.Single().Id);Assert.Greater(writes,afterChoose);
            var repeated=new CitySimulation();Assert.IsTrue(store.RestoreInitial(repeated,out _));Assert.AreEqual("surra",repeated.State.District);Assert.AreEqual(originalBuildingId,repeated.Buildings.Single().Id);
            var resumePointer=values[CityDistricts.ActiveSessionKey];foreach(var region in CityDistricts.Ids)Assert.IsTrue(store.TryRead(region,out _));Assert.AreEqual(resumePointer,values[CityDistricts.ActiveSessionKey]);
            values[CityDistricts.LegacySaveKey]=JsonUtility.ToJson(new CitySave{Version=1,Started=true,District=null,Roads=new[]{"24,19"},Buildings=new[]{new BuildingRecord(BuildingKind.Villa,25,19){Id="legacy-house"}}});
            Assert.IsTrue(store.HasLegacy);Assert.IsTrue(store.ResumeLegacy(current,out var legacyResume),legacyResume);Assert.AreEqual("legacy-house",current.Buildings.Single().Id);
            Assert.IsTrue(store.ResumeLegacy(current,out _));Assert.AreEqual("legacy-house",current.Buildings.Single().Id);
        }
        [Test] public void ResetIsScopedToOneDistrictAndWillNotOverwriteCorruptData()
        {
            var values=new Dictionary<string,string>();var store=MemoryStore(values,()=>{});
            var current=new CitySimulation();Assert.IsTrue(store.Choose("surra",current,out _));var surraKey=CityDistricts.SaveKey("surra");string existing=values[surraKey];
            Assert.IsTrue(store.Choose("yarmouk",current,out _));string other=values[CityDistricts.SaveKey("yarmouk")];
            Assert.IsTrue(values.ContainsKey(CityDistricts.SaveKey("yarmouk")));
            Assert.IsTrue(store.ResetCurrent(current,out _));Assert.AreEqual("yarmouk",current.State.District);Assert.AreEqual(0,current.Buildings.Count);Assert.AreEqual(existing,values[surraKey]);
            current.Place(BuildingKind.Villa,CityDistricts.Get("yarmouk").Parcels[0].C,CityDistricts.Get("yarmouk").Parcels[0].R,out _);store.SaveCurrent(current);string good=values[CityDistricts.SaveKey("yarmouk")];
            values[CityDistricts.SaveKey("yarmouk")]="corrupt";Assert.IsFalse(store.ResetCurrent(current,out _));Assert.AreEqual(1,current.Buildings.Count);Assert.AreEqual("corrupt",values[CityDistricts.SaveKey("yarmouk")]);Assert.IsFalse(good.Equals(values[CityDistricts.SaveKey("yarmouk")]));
        }
        private static CitySessionStore MemoryStore(Dictionary<string,string> values,Action wrote)
        {return new CitySessionStore((key,value)=>value!=null,key=>values.TryGetValue(key,out var value)?value:null,(key,value)=>{values[key]=value;wrote();});}
        [Test] public void ACorruptActiveSaveCannotDestroyItsGoodInMemoryCity()
        {
            var values=new Dictionary<string,string>();int writes=0;var store=MemoryStore(values,()=>writes++);
            var city=new CitySimulation();Assert.IsTrue(store.Choose("yarmouk",city,out _));var parcel=CityDistricts.Get("yarmouk").Parcels[0];Assert.IsTrue(city.Place(BuildingKind.Villa,parcel.C,parcel.R,out _));store.SaveCurrent(city);
            values[CityDistricts.SaveKey("yarmouk")]="CORRUPT";int before=writes;bool threw=false;
            try{store.SaveCurrent(city);}catch(InvalidOperationException){threw=true;}
            Assert.IsTrue(threw);Assert.AreEqual("CORRUPT",values[CityDistricts.SaveKey("yarmouk")]);Assert.AreEqual(before,writes);Assert.AreEqual(1,city.Buildings.Count);Assert.AreEqual("yarmouk",city.State.District);
        }
        [Test] public void CorruptSelectedSaveDoesNotClearLiveCityOrOverwriteTarget()
        {
            var values=new Dictionary<string,string>();int writes=0;
            var store=new CitySessionStore((key,value)=>value!=null,(key)=>values.TryGetValue(key,out var value)?value:null,(key,value)=>{values[key]=value;writes++;});
            var city=new CitySimulation();Assert.IsTrue(store.Choose("surra",city,out _));
            values[CityDistricts.SaveKey("adailiya")]="not-a-city";int previous=writes;var before=city.State.District;
            Assert.IsFalse(store.Choose("adailiya",city,out _));Assert.AreEqual(before,city.State.District);Assert.AreEqual(previous,writes);
            Assert.AreEqual("not-a-city",values[CityDistricts.SaveKey("adailiya")]);
        }
    }
}
