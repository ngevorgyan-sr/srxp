/* sr.xp v3 — locked Glass Studio button preset (tuning session 2026-09-29).
   Read by js/glass-buttons.js; header buttons ripple without lifting. */
window.SRXP_GLASS = {
  noLift: ".bar .sr-btn",
  dark: ".box.ok .sr-btn", // buttons inside the dark "Unlocked" card
  settings: {
    "duration": 1000,
    "strength": 2,
    "width": 0.8,
    "dispersion": 4.65,
    "glow": 0.2,
    "sheen": 0.03,
    "stretch": 0.012,
    "lift": 3,
    "hoverScale": 1.004,
    "travel": [
      0.25,
      0.1,
      0.35,
      1
    ],
    "envelope": [
      {
        "t": 0,
        "value": 0,
        "ease": [
          0.3266,
          0.323,
          0.6667,
          1
        ]
      },
      {
        "t": 0.1517,
        "value": 0.1656,
        "ease": [
          0.6722,
          0.4776,
          0.6667,
          1
        ]
      },
      {
        "t": 0.4671,
        "value": 0.6027,
        "ease": [
          0.3333,
          0,
          0.708,
          0.5934
        ]
      },
      {
        "t": 0.65,
        "value": 0.65,
        "ease": [
          0.3143,
          0.3702,
          0.6667,
          1
        ]
      },
      {
        "t": 1,
        "value": 0
      }
    ],
    "radius": 0.9,
    "highlightSize": 1,
    "coreGlow": 0,
    "coreDuration": 1120,
    "ringSoftness": 1,
    "stretchDuration": 1310,
    "stretchDelay": 0,
    "origin": {
      "x": 0,
      "y": 0.5
    },
    "hoverOrigin": "entry",
    "clickOrigin": "pointer",
    "spectrum": [
      {
        "position": 0,
        "color": "#ff1e00"
      },
      {
        "position": 0.2329,
        "color": "#ffd26e"
      },
      {
        "position": 0.495,
        "color": "#70e7e3"
      },
      {
        "position": 0.7195,
        "color": "#824dff"
      },
      {
        "position": 1,
        "color": "#e8c2ff"
      }
    ],
    "spectrumShift": [
      {
        "t": 0,
        "value": -92.9845,
        "ease": [
          0.3663,
          1,
          0.6627,
          0.7231
        ]
      },
      {
        "t": 0.4838,
        "value": 8.4333,
        "ease": [
          0.2931,
          0,
          0.4262,
          0.4244
        ]
      },
      {
        "t": 1,
        "value": 177.7117
      }
    ],
    "coreEnvelope": [
      {
        "t": 0,
        "value": 0
      },
      {
        "t": 0.14,
        "value": 0.72
      },
      {
        "t": 0.28,
        "value": 1
      },
      {
        "t": 0.65,
        "value": 0.65
      },
      {
        "t": 1,
        "value": 0
      }
    ],
    "coreMotion": {
      "startScale": 1,
      "releaseScale": 1,
      "endScale": 1,
      "contractStart": 0,
      "contractCurve": [
        0,
        0,
        1,
        1
      ],
      "expandCurve": [
        0,
        0,
        1,
        1
      ]
    },
    "stretchTravel": [
      0.25,
      0.1,
      0.35,
      1
    ],
    "stretchEnvelope": [
      {
        "t": 0,
        "value": 0
      },
      {
        "t": 0.14,
        "value": 0.72
      },
      {
        "t": 0.28,
        "value": 1
      },
      {
        "t": 0.65,
        "value": 0.65
      },
      {
        "t": 1,
        "value": 0
      }
    ],
    "liftMotion": {
      "duration": 540,
      "delay": 0,
      "curve": [
        0.25,
        0.1,
        0.14,
        1
      ],
      "keyframes": [
        {
          "t": 0,
          "value": 0
        },
        {
          "t": 0.25,
          "value": 0.25
        },
        {
          "t": 0.5,
          "value": 0.5
        },
        {
          "t": 0.75,
          "value": 0.75
        },
        {
          "t": 1,
          "value": 1
        }
      ],
      "returnDuration": 240,
      "returnCurve": [
        0.22,
        0.61,
        0.36,
        1
      ],
      "returnKeyframes": [
        {
          "t": 0,
          "value": 0
        },
        {
          "t": 0.25,
          "value": 0.25
        },
        {
          "t": 0.5,
          "value": 0.5
        },
        {
          "t": 0.75,
          "value": 0.75
        },
        {
          "t": 1,
          "value": 1
        }
      ]
    },
    "scaleMotion": {
      "duration": 530,
      "delay": 0,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "keyframes": [
        {
          "t": 0,
          "value": 0
        },
        {
          "t": 0.25,
          "value": 0.25
        },
        {
          "t": 0.5,
          "value": 0.5
        },
        {
          "t": 0.75,
          "value": 0.75
        },
        {
          "t": 1,
          "value": 1
        }
      ],
      "returnDuration": 280,
      "returnCurve": [
        0.22,
        0.61,
        0.36,
        1
      ],
      "returnKeyframes": [
        {
          "t": 0,
          "value": 0
        },
        {
          "t": 0.25,
          "value": 0.25
        },
        {
          "t": 0.5,
          "value": 0.5
        },
        {
          "t": 0.75,
          "value": 0.75
        },
        {
          "t": 1,
          "value": 1
        }
      ]
    },
    "warmup": {
      "enabled": false,
      "start": 0.08,
      "release": 0.78,
      "previewDuration": 1000,
      "releaseFade": 336,
      "strength": 3.5,
      "width": 0.45,
      "glow": 0.075,
      "sheen": 0.2,
      "coreGlow": 0.28,
      "stretch": 0.003,
      "stretchY": 0,
      "curve": [
        0.42,
        0,
        0.58,
        1
      ],
      "coreEnvelope": [
        {
          "t": 0,
          "value": 1
        },
        {
          "t": 0.25,
          "value": 1
        },
        {
          "t": 0.5,
          "value": 1
        },
        {
          "t": 0.75,
          "value": 1
        },
        {
          "t": 1,
          "value": 1
        }
      ]
    },
    "surface": {
      "tintColor": "#EBE9E6",
      "cornerRadius": null,
      "refraction": 2,
      "chromAberration": 0.645,
      "edgeHighlight": 0.34,
      "specular": 0.41,
      "specularSharpness": 0.2,
      "fresnel": 0.85,
      "distortion": 1,
      "zRadius": 17,
      "opacity": 0,
      "brightness": 1,
      "shadowOpacity": 0.14,
      "shadowSpread": 0,
      "shadowCenterOpacity": 0.387,
      "shadowCenterSpread": 0,
      "videoShadowOpacity": 0.15,
      "videoShadowSpread": 8,
      "bevelMode": "pill",
      "tintOpacity": 2,
      "videoTintOpacity": 0.28,
      "blur": 1.7,
      "saturation": 1,
      "shine": 1,
      "edge": 1
    }
  },
};
