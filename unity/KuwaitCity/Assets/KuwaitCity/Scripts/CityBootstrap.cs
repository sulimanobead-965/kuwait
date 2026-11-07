using UnityEngine;

namespace KuwaitCity
{
    /** Scene entry point. URP asset/scene construction is explicit in the editor menu. */
    [DefaultExecutionOrder(0)]
    public sealed class CityBootstrap : MonoBehaviour
    {
        [SerializeField] private CityPalette palette;
        [SerializeField] private TextAsset landMask;
        public void SetSceneAssets(CityPalette source,TextAsset mask)
        {
            palette=source;landMask=mask;
        }
        private void Awake()
        {
            if(palette==null||landMask==null)
            {
                Debug.LogError("Run Kuwait City / Prepare Mobile URP Scene from the Editor first.");
                enabled=false;return;
            }
            var app=GetComponent<CityApp>();
            if(app==null)app=gameObject.AddComponent<CityApp>();
            app.InitializeGame(palette,landMask);
        }
    }
}
