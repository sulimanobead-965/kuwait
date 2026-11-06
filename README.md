# Kuwait City — real isometric web and Unity URP source

## Browser

```sh
npm install
npm run dev
npm run typecheck
npm run test:game
npm run build
```

`src/game/three/` replaces the original world's building sprites with original volumetric meshes. The Arabic HUD and original `sim.ts` / `catalog.ts` economy, roads, upgrades, ordinances, disasters, missions and v2 saves remain. The group adds an orthographic 32.5° / 45° camera, scene pan/zoom and touch pinch, 17 building models with three LOD tiers, landmarks, instanced traffic/palms, soft shadows and warm day/night emissive windows.

The starting showcase is separate from the user save. Restored cities are focused by the camera. WebGL failure shows an explicitly labelled interactive 2D compatibility view, not a hidden sprite replacement. HUD building thumbnails and floating income symbols are not used to impersonate 3D buildings.

Software-WebGL Chromium testing only, not physical mobile GPU profiling or an FPS claim. `npm test` has the same pending OG/PWA failures in the unmodified baseline.

## Unity / mobile

See [unity/README.md](unity/README.md). The project supplies original procedural volumetric models, URP/Cinemachine camera, touch, core companion economy and local saves, plus EditMode tests. **No Unity editor, Unity license, Android SDK or Xcode/iOS signing was available here**: the Unity scene generator, Arabic layout, native compilation, device performance and tests have not been verified in Unity. It is not a prebuilt Android/iPhone app, baked lightmap scene or full mission/disaster counterpart.

Neither version buys assets or publishes the live game. Landmarks are stylized procedural interpretations, not photorealistic assets or architectural scans.
