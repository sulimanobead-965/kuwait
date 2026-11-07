using System;
using UnityEngine;

namespace KuwaitCity
{
    /** The only native write boundary. Reading/browsing never changes a city or its resume pointer. */
    public sealed class CitySessionStore
    {
        private readonly Func<string,string,bool> exists;
        private readonly Func<string,string> read;
        private readonly Action<string,string> write;
        public CitySessionStore()
        {
            exists=(key,_)=>PlayerPrefs.HasKey(key);
            read=PlayerPrefs.GetString;
            write=(key,value)=>{PlayerPrefs.SetString(key,value);PlayerPrefs.Save();};
        }
        // Tests use memory, not device storage. Real PlayerPrefs remain the production dependency.
        public CitySessionStore(Func<string,string,bool> exists,Func<string,string> read,Action<string,string> write)
        {this.exists=exists;this.read=read;this.write=write;}
        public string ActiveId {get;private set;}
        public bool HasLegacy=>TryLoadExisting(null,out _);
        private string CurrentKey=>CityDistricts.Valid(ActiveId)?CityDistricts.SaveKey(ActiveId):CityDistricts.LegacySaveKey;
        private bool CurrentExists=>exists(CurrentKey,read(CurrentKey));
        private bool UsableCurrent()=>TryLoadExisting(ActiveId,out var state)&&state!=null;
        public bool TryRead(string id,out CitySave state)
        {
            state=null;
            bool district=CityDistricts.Valid(id);
            if(id!=null&&!district)return false;
            string key=district?CityDistricts.SaveKey(id):CityDistricts.LegacySaveKey;
            if(!exists(key,read(key)))return district;
            if(!CitySimulation.TryDecode(read(key),id,out state,out _))return false;
            if(district&&!ContainsOnlyParcels(state,id))return false;
            return true;
        }
        private static bool ContainsOnlyParcels(CitySave state,string id)
        {
            var district=CityDistricts.Get(id);
            foreach(var record in state.Buildings??Array.Empty<BuildingRecord>())
                if(record==null||!district.Buildable(record.C,record.R))return false;
            return true;
        }
        public bool RestoreInitial(CitySimulation model,out string message)
        {
            var pointer=read(CityDistricts.ActiveSessionKey);
            ActiveId=CityDistricts.Valid(pointer)?pointer:null;
            if(!string.IsNullOrEmpty(pointer)&&ActiveId==null)
            {message="مؤشر الحي الأخير غير معروف؛ لم أحذف أي حفظ. اختر حيًا أو استأنف المدينة القديمة.";return false;}
            if(TryLoadExisting(ActiveId,out var saved))
            {
                model.LoadSession(saved);
                message=ActiveId==null?"استعدنا مدينة الكويت القديمة":"استعدنا "+CityDistricts.ArabicName(ActiveId)+" المستقلة";
                return true;
            }
            if(ActiveId!=null)
            {message="حفظ الحي الأخير غير صالح؛ لم أستبدله. افتح الأحياء أو استأنف المدينة القديمة.";return false;}
            if(CurrentExists)
            {message="حفظ الكويت القديم غير مقروء؛ لم أستبدله بمدينة جديدة.";return false;}
            model.LoadSession(new CitySave());
            message="اختر الحي لبدء مدينة، أو ابدأ مدينة الكويت الأصلية";
            return true;
        }
        private bool TryLoadExisting(string id,out CitySave saved)
        {
            saved=null;
            string key=CityDistricts.Valid(id)?CityDistricts.SaveKey(id):CityDistricts.LegacySaveKey;
            return exists(key,read(key))&&TryRead(id,out saved)&&saved!=null;
        }
        public bool Choose(string id,CitySimulation model,out string message)
        {
            if(!CityDistricts.Valid(id)){message="هذا الحي غير موجود في اللوحات المدققة";return false;}
            if(!TryRead(id,out var next)){message="حفظ هذا الحي غير صالح؛ لم نمس المدينة أو الحفظ القديم.";return false;}
            try
            {
                SaveCurrent(model);
                model.LoadSession(next??CityDistricts.NewCity(id));model.SetSpeed(0);
                bool identityMatches=(model.State.District??"")==id;
                if(!identityMatches)throw new InvalidOperationException("The decoded district identity was not preserved.");
                ActiveId=id;Commit(model);message="دخلت "+CityDistricts.ArabicName(id)+" — التقدّم مستقل لكل حي";return true;
            }
            catch(Exception error)when(error is ArgumentException||error is InvalidOperationException)
            {message="تعذّر حفظ المدينة الحالية؛ لم يتغير الحي أو الحفظ.";return false;}
        }
        public bool ResumeLegacy(CitySimulation model,out string message)
        {
            if(!TryLoadExisting(null,out var next))
            {message="حفظ الكويت القديم غير مقروء؛ لم نستبدله بحي جديد.";return false;}
            try
            {
                SaveCurrent(model);model.LoadSession(next);model.SetSpeed(0);
                if(model.State.District!=null)throw new InvalidOperationException("The legacy save was assigned to a district.");
                ActiveId=null;write(CityDistricts.ActiveSessionKey,"");message="استعدت مدينة الكويت القديمة؛ مدن الأحياء لم تُحذف";return true;
            }
            catch(Exception error)when(error is ArgumentException||error is InvalidOperationException)
            {message="تعذّر حفظ المدينة الحالية؛ لم يتغير الحي أو الحفظ.";return false;}
        }
        public void SaveCurrent(CitySimulation model)
        {
            if(model==null||!model.State.Started)return;
            // A new selection may save a legacy game whose pointer was cleared by old data.
            // Never use this to repair/replace an existing unreadable file.
            if((model.State.District??"")!=(CityDistricts.Valid(ActiveId)?ActiveId:""))
                throw new InvalidOperationException("The active save identity does not match the live city.");
            if(CurrentExists&&!UsableCurrent())throw new InvalidOperationException("Refusing to overwrite an unreadable saved city.");
            write(CurrentKey,model.Encode());
        }
        private void Commit(CitySimulation model)
        {
            if((model.State.District??"")!=(CityDistricts.Valid(ActiveId)?ActiveId:""))throw new InvalidOperationException("The save identity does not match the model.");
            if(CurrentExists&&!UsableCurrent())throw new InvalidOperationException("Refusing to overwrite an unreadable saved city.");
            write(CurrentKey,model.Encode());write(CityDistricts.ActiveSessionKey,ActiveId??"");
        }
        public bool ResetCurrent(CitySimulation model,out string message)
        {
            if(CurrentExists&&!UsableCurrent())
            {message="تعذّر قراءة حفظ هذه المدينة؛ لم أستبدلها بمدينة جديدة.";return false;}
            var fresh=CityDistricts.Valid(ActiveId)?CityDistricts.NewCity(ActiveId):new CitySave{Started=true,Speed=1,District=null};
            model.LoadSession(fresh);Commit(model);message="بدأت هذه المدينة فقط من جديد؛ حِفظ الأحياء الأخرى باقٍ";return true;
        }
    }
}
