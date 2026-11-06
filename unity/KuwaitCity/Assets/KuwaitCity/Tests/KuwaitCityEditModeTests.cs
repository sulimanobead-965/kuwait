using NUnit.Framework;
using System;
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
            Assert.IsFalse(restored.DecodeAndRestore("{\"Version\":2}",out _));Assert.IsFalse(restored.DecodeAndRestore("",out _));
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
