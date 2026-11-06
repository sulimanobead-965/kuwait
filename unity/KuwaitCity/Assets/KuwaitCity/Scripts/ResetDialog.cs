using System;
using UnityEngine;

namespace KuwaitCity
{
    public sealed class CityResetDialog : MonoBehaviour
    {
        private Action confirmed;
        private CityHud host;
        public void Configure(Action confirm) {confirmed=confirm;}
        public void Show()
        {
            host=GetComponent<CityHud>();
            if(host==null)throw new InvalidOperationException("HUD must exist before the confirmation modal.");
            host.ShowResetConfirmation(()=>{confirmed?.Invoke();});
        }
    }
}
