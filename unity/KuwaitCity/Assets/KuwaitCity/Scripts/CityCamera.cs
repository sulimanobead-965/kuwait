using System;
using System.Collections.Generic;
using Unity.Cinemachine;
using Unity.Cinemachine.TargetTracking;
using UnityEngine;
using UnityEngine.EventSystems;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
#endif

namespace KuwaitCity
{
    /** Real orthographic Cinemachine rig. A tap is never consumed as a camera pan. */
    [DefaultExecutionOrder(50)]
    public sealed class CityCamera : MonoBehaviour
    {
        private struct Finger
        {
            public Vector2 Start;
            public Vector2 Current;
            public bool StartedOnUI;
            public bool UsedForPan;
        }

        private CinemachineCamera virtualCamera;
        private readonly Dictionary<int, Finger> fingers = new Dictionary<int, Finger>();
        private Transform pivot;
        private Vector3 goal;
        private float pinchDistance, pinchSize;
        private float desiredSize = 29f;
        private bool dragging, pinching;
        private int activeFinger = -1;
        private bool tapPending;
        private Vector2 tapScreen;
        public Camera MainCamera { get; private set; }
        public event Action<Vector2Int> Interacted;
        public int ActiveFinger { get { return activeFinger; } }
        public bool Dragging { get { return dragging || pinching; } }

        public void Configure(Camera camera, CinemachineCamera rig, Transform focus)
        {
            MainCamera = camera;
            MainCamera.orthographic = true;
            MainCamera.orthographicSize = desiredSize;
            MainCamera.clearFlags = CameraClearFlags.SolidColor;
            MainCamera.nearClipPlane = .2f;
            MainCamera.farClipPlane = 300f;
            MainCamera.backgroundColor = new Color(.54f, .74f, .78f);
            virtualCamera = rig;
            if (virtualCamera == null) virtualCamera = new GameObject("Cinemachine orthographic 45 / 32.5").AddComponent<CinemachineCamera>();
            virtualCamera.transform.rotation = Quaternion.Euler(32.5f, 315f, 0f);
            var lens = virtualCamera.Lens;
            lens.ModeOverride = LensSettings.OverrideModes.Orthographic;
            lens.OrthographicSize = desiredSize;
            virtualCamera.Lens = lens;
            var follow = virtualCamera.GetComponent<CinemachineFollow>();
            if (follow == null) follow = virtualCamera.gameObject.AddComponent<CinemachineFollow>();
            follow.FollowOffset = new Vector3(54f, 48.36f, 54f); // WorldSpace: 45 degree yaw, approximately 32.5 degree ground-facing pitch.
            follow.TrackerSettings.BindingMode = BindingMode.WorldSpace;
            follow.TrackerSettings.PositionDamping = new Vector3(.18f, .18f, .18f);
            pivot = focus == null ? new GameObject("City camera focus").transform : focus;
            pivot.SetParent(transform, false);
            pivot.localPosition = new Vector3(3.3f, .3f, 20.9f);
            pivot.rotation = Quaternion.identity;
            goal = pivot.position;
            virtualCamera.Follow = pivot;
            var brain=MainCamera.GetComponent<CinemachineBrain>();
            if (brain == null) brain=MainCamera.gameObject.AddComponent<CinemachineBrain>();
            brain.LensModeOverride.Enabled=true;
            brain.LensModeOverride.DefaultMode=LensSettings.OverrideModes.Orthographic;
            virtualCamera.transform.rotation=Quaternion.LookRotation(-follow.FollowOffset,Vector3.up);
            MainCamera.transform.position=pivot.position+follow.FollowOffset;
            MainCamera.transform.rotation=virtualCamera.transform.rotation;
        }

#if ENABLE_INPUT_SYSTEM
        private void OnEnable() { EnhancedTouchSupport.Enable(); }
        private void OnDisable() { EnhancedTouchSupport.Disable(); }
#endif

        private void Update()
        {
            tapPending = false; // Only this frame's just-released tap is available to the controller.
            if (virtualCamera != null)
            {
#if ENABLE_INPUT_SYSTEM
                ReadCurrentInput();
#else
                ReadLegacyInput();
#endif
                var smoothing = 1f - Mathf.Exp(-Time.unscaledDeltaTime * 11f);
                pivot.position = Vector3.Lerp(pivot.position, goal, smoothing);
                var current = virtualCamera.Lens;
                current.OrthographicSize = Mathf.Lerp(current.OrthographicSize, desiredSize, smoothing);
                virtualCamera.Lens = current;
            }
        }

        private void ReadCurrentInput()
        {
#if ENABLE_INPUT_SYSTEM
            var touches = Touch.activeTouches;
            if (touches.Count >= 2)
            {
                var a = touches[0]; var b = touches[1];
                if (a.phase == UnityEngine.InputSystem.TouchPhase.Began || b.phase == UnityEngine.InputSystem.TouchPhase.Began)
                {
                    pinchDistance = Vector2.Distance(a.screenPosition, b.screenPosition);
                    pinchSize = desiredSize;
                }
                if (pinchDistance > 0f)
                {
                    var distance = Vector2.Distance(a.screenPosition, b.screenPosition);
                    desiredSize = Mathf.Clamp(pinchSize * pinchDistance / Mathf.Max(20f, distance), 7f, 58f);
                }
                pinching = true; dragging = true; tapPending = false;
                return;
            }
            if (pinching)
            {
                pinching = false; dragging = false; activeFinger = -1;
                fingers.Clear();
                return;
            }
            if (touches.Count == 1)
            {
                var t = touches[0];
                if (t.phase == UnityEngine.InputSystem.TouchPhase.Began) Begin(t.touchId, t.screenPosition);
                else
                {
                    Move(t.touchId, t.screenPosition);
                    if (t.phase == UnityEngine.InputSystem.TouchPhase.Ended || t.phase == UnityEngine.InputSystem.TouchPhase.Canceled)
                        End(t.touchId, t.screenPosition, t.phase == UnityEngine.InputSystem.TouchPhase.Canceled);
                }
                return;
            }
            var mouse = Mouse.current;
            if (mouse != null)
            {
                var scroll = mouse.scroll.ReadValue().y;
                if (Mathf.Abs(scroll) > .001f) Zoom(scroll > 0f ? 1.12f : .89f);
                if (mouse.leftButton.wasPressedThisFrame) Begin(-2, mouse.position.ReadValue());
                if (mouse.leftButton.isPressed) Move(-2, mouse.position.ReadValue());
                if (mouse.leftButton.wasReleasedThisFrame) End(-2, mouse.position.ReadValue(), false);
            }
#endif
        }

        private void ReadLegacyInput()
        {
            var scroll = Input.mouseScrollDelta.y;
            if (Mathf.Abs(scroll) > .001f) Zoom(scroll > 0f ? 1.12f : .89f);
            if (Input.touchSupported && Input.touchCount > 0)
            {
                if (Input.touchCount >= 2)
                {
                    var a = Input.GetTouch(0); var b = Input.GetTouch(1);
                    if (a.phase == TouchPhase.Began || b.phase == TouchPhase.Began)
                    { pinchDistance = Vector2.Distance(a.position, b.position); pinchSize = desiredSize; }
                    pinching = true; dragging = true; tapPending = false;
                    if (pinchDistance > 0f)
                        desiredSize = Mathf.Clamp(pinchSize * pinchDistance / Mathf.Max(20f, Vector2.Distance(a.position, b.position)), 7f, 58f);
                    return;
                }
                if (pinching) { pinching = false; dragging = false; activeFinger = -1; fingers.Clear(); return; }
                var touch = Input.GetTouch(0);
                if (touch.phase == TouchPhase.Began) Begin(touch.fingerId, touch.position);
                else
                {
                    Move(touch.fingerId, touch.position);
                    if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
                        End(touch.fingerId, touch.position, touch.phase == TouchPhase.Canceled);
                }
                return;
            }
            if (Input.GetMouseButtonDown(0)) Begin(-2, Input.mousePosition);
            if (Input.GetMouseButton(0)) Move(-2, Input.mousePosition);
            if (Input.GetMouseButtonUp(0)) End(-2, Input.mousePosition, false);
        }

        private void Begin(int id, Vector2 position)
        {
            activeFinger = id;
            dragging = false;
            fingers[id] = new Finger { Start = position, Current = position, StartedOnUI = IsOverUI(id, position) };
        }

        private void Move(int id, Vector2 position)
        {
            if (!fingers.TryGetValue(id, out var finger) || activeFinger != id) return;
            var previous = finger.Current;
            finger.Current = position;
            if (Vector2.Distance(finger.Start, position) > 10f) finger.UsedForPan = true;
            fingers[id] = finger;
            if (!finger.StartedOnUI && finger.UsedForPan)
            {
                Pan(position - previous); dragging = true; tapPending = false;
            }
        }

        private void End(int id, Vector2 position, bool cancelled)
        {
            if (fingers.TryGetValue(id, out var finger) && !cancelled && !finger.StartedOnUI && !finger.UsedForPan && !dragging)
            {
                tapPending = true; tapScreen = position;
                if (GroundPoint(tapScreen, out var point)) Interacted?.Invoke(CityLand.Cell(point));
            }
            fingers.Remove(id); activeFinger = -1; dragging = false;
        }

        public bool TryPickGround(out Vector2Int cell)
        {
            cell = default;
            if (!tapPending || !GroundPoint(tapScreen, out var point)) return false;
            cell = CityLand.Cell(point);
            tapPending = false;
            return true;
        }

        private static bool IsOverUI(int id, Vector2 position)
        {
            if (EventSystem.current == null) return false;
            var data = new PointerEventData(EventSystem.current) { pointerId = id, position = position };
            var hits = new List<RaycastResult>();
            EventSystem.current.RaycastAll(data, hits);
            return hits.Count > 0;
        }

        public void Focus(Vector3 center)
        {
            goal=new Vector3(center.x,.3f,center.z);
            if(pivot!=null)pivot.position=goal;
        }
        public void Zoom(float factor) { desiredSize = Mathf.Clamp(desiredSize / factor, 7f, 58f); }

        public void Pan(Vector2 screenDelta)
        {
            var yaw = 45f * Mathf.Deg2Rad;
            var right = new Vector3(Mathf.Cos(yaw), 0f, -Mathf.Sin(yaw));
            var forward = new Vector3(-Mathf.Sin(yaw), 0f, -Mathf.Cos(yaw));
            var pixelToGround = (virtualCamera.Lens.OrthographicSize * 2f) / Mathf.Max(1, Screen.height);
            goal += right * (screenDelta.x * pixelToGround);
            goal += forward * (-screenDelta.y * pixelToGround / Mathf.Sin(32.5f * Mathf.Deg2Rad));
            goal = new Vector3(Mathf.Clamp(goal.x, -54f, 56f), .3f, Mathf.Clamp(goal.z, -37f, 38f));
        }

        public bool GroundPoint(Vector2 screen, out Vector3 point)
        {
            if (MainCamera != null)
            {
                var ray = MainCamera.ScreenPointToRay(screen);
                var plane = new Plane(Vector3.up, new Vector3(0f, .3f, 0f));
                if (plane.Raycast(ray, out var distance)) { point = ray.GetPoint(distance); return true; }
            }
            point = Vector3.zero;
            return false;
        }
    }
}
