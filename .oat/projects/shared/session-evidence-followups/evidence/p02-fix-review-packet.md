# Immutable phase review packet

Captured: 2026-09-20T23:11:29.652287+00:00
Repository: /Users/tstang/orca/workspaces/skills/session-fidelity
Base: 6d7ec63c9d42feb6a9423bc301e64127428969a2
Reviewed HEAD: 9a74ed1d8b6ca5bc7354e6bdc45bdae052ac0487
Checkout status: clean

## Request

Verify the bounded p02 follow-up fixes against prior Opus review af48661b-3642-4447-8bec-cd81881f0bea, base6d7ec63c9d42feb6a9423bc301e64127428969a2. Review changed behavior and regression risk, not unchanged whole phase. No edits or providers. Read surrounding immutable source as needed.
H1 response usage checks native thread_id against source.nativeSessionId; originating session_id does not falsely reject own usage. Native fixture includes distinct root/thread plus genuinewrong-thread case.
H2 bounded watch/catch-up preserves delivered calls/results despite hundreds of optional whole-source usage/skill records. Optional metadata trims first with honest counts and captured-source scope. No accidental starvation of existing coverage/diagnostic signals; bounded report <=limit when irreduciblefloorpermits. Full futurecompletecapture must still be able to retain metadata withouttotalcap.
M1 cumulative/last-turn usage preserves Codex root/child/inherited/unknown ownership and reset segmentation does not falsely bridge ownership boundaries. Missing/contradictory boundary staysunknown, model joins avoidwrongownership. H1 response handling and ownership should coexist.
M2 full native Skill caller arguments restored underpreviewcap; only separate attachment instructionbodiesexcluded. No unrecordednarrowing.
L1 source-name coverage explicitly distinguishes its native carrier from event-levelskill evidence; validemptylisting versus absent, consumer/watchguards coherent. L2 repeatedavailable names dedup with documentedrepresentativelocator, invokedoccurrencesretained; budget/locators/counts remainhonest.
Check relevant regression tests and changed docs/versions/changelog/generated parity. Report unresolved originalissues or concrete newdefects. Response uses externaldocument anchor with exactpacketSHA256 and repo path/lines in evidence. ZeroCritical/High means pass (Medium/Low permitted); changes_requested requiresCritical/High. State unrunchecks.


## Scope adaptation

The base-branch selector captures entire before/after files including generated bundles and is capped at 2 MiB. This packet preserves the exact authored before/after Git diff (including deletions), all changed-file hashes, and immutable base/head references instead. Historical review artifacts and previously captured review packets are represented by hashes rather than recursively embedded; they remain available through the immutable revisions for context. Generated content is checked by build:check and version validation, with parity inspected where needed. The reviewer may read repository context and git-show either immutable revision but must not mutate any file or invoke providers. The whole checkout stays stable during review. Findings should use an anchor into THIS external packet with the exact packet SHA256 supplied by the wrapper; name the affected repository path/line in the claim/evidence. Never invent captured repository locations for files that are only context. This is a code-diff review carried as an external document, not an architecture-only plan review.

## Changed file manifest

```json
[
  {
    "path": ".oat/projects/shared/session-evidence-followups/implementation.md",
    "generated": false,
    "base": {
      "bytes": 21576,
      "sha256": "7c686b873ce95970888409c6267cfbd137373ad2c7532b474220a0dd2c96c300"
    },
    "head": {
      "bytes": 23407,
      "sha256": "723ce7b475e0a4d5dfa9d6d87bc7cef9ce2e791cd4c605509cb7696b6ac64f8d"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/plan.md",
    "generated": false,
    "base": {
      "bytes": 29277,
      "sha256": "8fe5ab418206f81ec4117bc54cce91053462a073ed68ee26857edf5f1a308c5b"
    },
    "head": {
      "bytes": 29275,
      "sha256": "a14a3dc67dd5cac1a898b80afa1ec0ca4f82a2dd4f2287807310fb6320ae92a1"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/project-log.md",
    "generated": false,
    "base": {
      "bytes": 2745,
      "sha256": "4096e668d6e37e9aea8d6228320e3569cffd2f1d5fd6cc9feda90e350311b8a5"
    },
    "head": {
      "bytes": 2983,
      "sha256": "27342be2d1e6565ba3c86c0bde09fdcb70aa4898f337b55c431fccf4f9109dc2"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/state.md",
    "generated": false,
    "base": {
      "bytes": 6878,
      "sha256": "68c05883cc38fa58be600cc0832cf9495d543e6e6d6773e5ea2f8f441fd6c374"
    },
    "head": {
      "bytes": 6881,
      "sha256": "be61748f04e38507a80bab392de08e6c30ab7663b5bda1705e981f9ece90d2a9"
    }
  },
  {
    "path": "CHANGELOG.md",
    "generated": false,
    "base": {
      "bytes": 41770,
      "sha256": "59503b1c7ed709d7f1eba2fee9f94f82804fd006226e9adc65b70386d050bd4d"
    },
    "head": {
      "bytes": 42278,
      "sha256": "3d0a67d78d2e093dd4fe35b48dcb86a97f6d008d099ca58e7fb8e7bd9caa6409"
    }
  },
  {
    "path": "documentation/docs/engineering/architecture/session-schemas/claude-code.md",
    "generated": false,
    "base": {
      "bytes": 52084,
      "sha256": "613fc7bd8554583a6e50f4130436b4b5791e48ea05e761566cc0a9b32978e25e"
    },
    "head": {
      "bytes": 52437,
      "sha256": "cc7ad9b190bf2c4050ed05b2e13572df5c06326c9f2583207f0e9a56b9302e5d"
    }
  },
  {
    "path": "documentation/docs/engineering/architecture/session-schemas/codex.md",
    "generated": false,
    "base": {
      "bytes": 28672,
      "sha256": "a0fc47288db37d26a75de46726b9d09633efe104a706683cfc485e6cc3663132"
    },
    "head": {
      "bytes": 29007,
      "sha256": "60e53e9946bbdec4147dbeb395551b9b864dac8e830506eb15c2aa6b533935c7"
    }
  },
  {
    "path": "documentation/docs/engineering/architecture/session-schemas/cursor.md",
    "generated": false,
    "base": {
      "bytes": 16983,
      "sha256": "35368c8773f03d0bedee3ce9bb724a12dc04a13bee6f651b0d8a7ff947d6b974"
    },
    "head": {
      "bytes": 17170,
      "sha256": "b240f2d03f1d1a2503912abd4d57c7dae683a0d23d1ab0af2972ad7e84bacf09"
    }
  },
  {
    "path": "documentation/docs/engineering/architecture/session-schemas/index.md",
    "generated": false,
    "base": {
      "bytes": 10847,
      "sha256": "c6b2c9fec0484303fe13f892f80205f0819892219026891176e7bcede3a2ce1f"
    },
    "head": {
      "bytes": 11559,
      "sha256": "03429f72aaa57bccd81285eff0a967fa2b14d39fe412eca457501637072ad6ec"
    }
  },
  {
    "path": "documentation/docs/user-guide/skills/session-export-transcript.md",
    "generated": false,
    "base": {
      "bytes": 8321,
      "sha256": "d6a34af0bf12f5eae1dc13a3800028b112dc59b44da06d4065b55fb3d221c21f"
    },
    "head": {
      "bytes": 9012,
      "sha256": "635ee0a11e03ea82e3d1c597c753457d4ea5390db06705ff9d615f1c774da5b4"
    }
  },
  {
    "path": "documentation/docs/user-guide/skills/session-observer.md",
    "generated": false,
    "base": {
      "bytes": 23324,
      "sha256": "38ead89ec7a3e0447def177cc24e72d6c78225a157290dd5d4e62256ff1debed"
    },
    "head": {
      "bytes": 24251,
      "sha256": "f61bc02b850514b4f42cbd212e7b269c2aa10ce412741d4d2c7d66552d1c3f49"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 21438,
      "sha256": "a8e049f8ecb81770f6c8527aa366383e155a0486a84b04fcf8942ab2dd6c39ce"
    },
    "head": {
      "bytes": 21438,
      "sha256": "1e14f237871da54a9c14be3fef79d81ed5a8c155cd8040bfdd33b8e2162927d2"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/claude-monitor.mjs",
    "generated": true,
    "base": {
      "bytes": 319818,
      "sha256": "26af48d691ebac8c9ed90c6117afea352f5ed56aa815dcc1ea9ba7b3ae707c89"
    },
    "head": {
      "bytes": 323930,
      "sha256": "801b351efacbbd8f462f329482e10118620a08b754d12021254963cc75763b1c"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/hooks/codex-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 298033,
      "sha256": "f373b2a316ec559b3d313e486d0fd9ca8f93bc9f59fa44e4c3d9ab30b3213aad"
    },
    "head": {
      "bytes": 302145,
      "sha256": "472efb2265cd6c41fed251cfcd7c60ded0b73e30115626cdf614b8420a244bc9"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/hooks/cursor-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 240782,
      "sha256": "3f130e722038e3a5fada5cfb3c43d9e22d440c34b6ed24f2c1eb68262b814571"
    },
    "head": {
      "bytes": 244894,
      "sha256": "68894a93ff574c8a17738f7511631f55477b46af2afbc13b1f1b2522d04cdfc6"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/lib/selected-prefix.mjs",
    "generated": true,
    "base": {
      "bytes": 181991,
      "sha256": "9ee92acdc20f890e7cf61ea9e7999b58860231a538d538f59cc429fad21636bf"
    },
    "head": {
      "bytes": 186103,
      "sha256": "d7fa6ca5f4d2c026fef2477b05f623f20ceebac5441966528ebf340dbad4127f"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 48764,
      "sha256": "d2ce35ef8634f71c59ed53f81c948c36d37bb3bd955c523f8845a751566b6858"
    },
    "head": {
      "bytes": 48764,
      "sha256": "599e5d09bc6446645e56f7b3bf3004970d202324755d388bf6a3eeed10cac272"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/digest.mjs",
    "generated": true,
    "base": {
      "bytes": 169188,
      "sha256": "f3b451d8cedcabe40a29b827bf8b06e6ed5cd1ebf2d5b435f76c76eb2afc3171"
    },
    "head": {
      "bytes": 173300,
      "sha256": "ba8b1a32af1883ec9a4ae7639e5e151bb004bc04f4bf37426e156ab00a68a337"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/observe.mjs",
    "generated": true,
    "base": {
      "bytes": 339460,
      "sha256": "3a59cdf88aafec72ffe736119b7a54ca782a478640680faaeb8955eb730c3432"
    },
    "head": {
      "bytes": 343572,
      "sha256": "47ffabfd103a8a4feb171b6e0085406129167c391136c7ebc8104e52953f868f"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/watch.mjs",
    "generated": true,
    "base": {
      "bytes": 414895,
      "sha256": "74b10322eb8832927b3a2d70cec9a29c0e51838deb1d326067b21ee85007120a"
    },
    "head": {
      "bytes": 419019,
      "sha256": "ad732280dfcc371f4c0a4f6845341c141d04da7e1ce910a21bd41eeea020a5da"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/session-observer.mjs",
    "generated": true,
    "base": {
      "bytes": 484397,
      "sha256": "250cbce91c1f411dd6fd4899b32ddc367f3a609dc4635d3ff4c6ada30d5d6227"
    },
    "head": {
      "bytes": 488521,
      "sha256": "0e3cc33798be9d82ba3d5c0b7271e2c195e57392961349029b99cfbebb525532"
    }
  },
  {
    "path": "plugins/session/skills/export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 11592,
      "sha256": "d6fee8c02ba2d54f13fda4c707412880bbe660d80355019e02fb268721d9b2e2"
    },
    "head": {
      "bytes": 11592,
      "sha256": "3327f75d6b9c244ffb37d2014fe3b01f4cafaf1cb975fca6087cf3af69b36b6c"
    }
  },
  {
    "path": "plugins/session/skills/export-transcript/scripts/session-export-transcript.mjs",
    "generated": true,
    "base": {
      "bytes": 157860,
      "sha256": "1c276a43012ee22f0a04a3f9d86c09d3b19271df89a1440d5c0a3e6a4f03bca6"
    },
    "head": {
      "bytes": 161972,
      "sha256": "0c9a1a72773abaca6bd90fe3bcb56237aaa10ae5345954bad5b96010a0e7681d"
    }
  },
  {
    "path": "plugins/session/skills/fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4412,
      "sha256": "683b8e16f2a8ffe0b34eaf1634dd4ca582e967e8eb016baa01a9637acfc650a8"
    },
    "head": {
      "bytes": 4412,
      "sha256": "416d583525d56e2498686ca35f820bebe15f1b58d8b04edbf7f75b1e6cdbc300"
    }
  },
  {
    "path": "skills/session-export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 11608,
      "sha256": "e938b363a102b3111b8b33e0f35faa87b08aca670eafcab07251836847c61b69"
    },
    "head": {
      "bytes": 11608,
      "sha256": "7a5b082a3085c3ca4fa6ad73371a0a32619d75197a2311f2909bdc98f838771f"
    }
  },
  {
    "path": "skills/session-export-transcript/scripts/session-export-transcript.mjs",
    "generated": true,
    "base": {
      "bytes": 157860,
      "sha256": "1c276a43012ee22f0a04a3f9d86c09d3b19271df89a1440d5c0a3e6a4f03bca6"
    },
    "head": {
      "bytes": 161972,
      "sha256": "0c9a1a72773abaca6bd90fe3bcb56237aaa10ae5345954bad5b96010a0e7681d"
    }
  },
  {
    "path": "skills/session-fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4428,
      "sha256": "e55d9055de1421704efe50fc0e7bb185c74af6a9de17d79783a3b9aae29c3402"
    },
    "head": {
      "bytes": 4428,
      "sha256": "73305193e7540568f7e5ec39617174cc5da992ade1eedb855f7c9b2ca121b097"
    }
  },
  {
    "path": "skills/session-observer-collab/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 21502,
      "sha256": "c42987d86df726b01ae2a3b952949cc06f964cc21ae3f626107faeaf0316706d"
    },
    "head": {
      "bytes": 21502,
      "sha256": "f233a8aae79c640be713092f9fd657bd8dc5dff295a2f2a049a1834f2acac808"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/claude-monitor.mjs",
    "generated": true,
    "base": {
      "bytes": 319818,
      "sha256": "26af48d691ebac8c9ed90c6117afea352f5ed56aa815dcc1ea9ba7b3ae707c89"
    },
    "head": {
      "bytes": 323930,
      "sha256": "801b351efacbbd8f462f329482e10118620a08b754d12021254963cc75763b1c"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/hooks/codex-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 298033,
      "sha256": "f373b2a316ec559b3d313e486d0fd9ca8f93bc9f59fa44e4c3d9ab30b3213aad"
    },
    "head": {
      "bytes": 302145,
      "sha256": "472efb2265cd6c41fed251cfcd7c60ded0b73e30115626cdf614b8420a244bc9"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/hooks/cursor-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 240782,
      "sha256": "3f130e722038e3a5fada5cfb3c43d9e22d440c34b6ed24f2c1eb68262b814571"
    },
    "head": {
      "bytes": 244894,
      "sha256": "68894a93ff574c8a17738f7511631f55477b46af2afbc13b1f1b2522d04cdfc6"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/lib/selected-prefix.mjs",
    "generated": true,
    "base": {
      "bytes": 181991,
      "sha256": "9ee92acdc20f890e7cf61ea9e7999b58860231a538d538f59cc429fad21636bf"
    },
    "head": {
      "bytes": 186103,
      "sha256": "d7fa6ca5f4d2c026fef2477b05f623f20ceebac5441966528ebf340dbad4127f"
    }
  },
  {
    "path": "skills/session-observer/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 48780,
      "sha256": "90adef5360c588cfafc12216430e5f4b8ad7bfc59862da7bf1fdb74001d144e7"
    },
    "head": {
      "bytes": 48780,
      "sha256": "c6d12835e1ae7fd8c620093db7f30296f3cf444af0b66cf76e0f21e2bb5bc2a2"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/digest.mjs",
    "generated": true,
    "base": {
      "bytes": 169188,
      "sha256": "f3b451d8cedcabe40a29b827bf8b06e6ed5cd1ebf2d5b435f76c76eb2afc3171"
    },
    "head": {
      "bytes": 173300,
      "sha256": "ba8b1a32af1883ec9a4ae7639e5e151bb004bc04f4bf37426e156ab00a68a337"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/observe.mjs",
    "generated": true,
    "base": {
      "bytes": 339460,
      "sha256": "3a59cdf88aafec72ffe736119b7a54ca782a478640680faaeb8955eb730c3432"
    },
    "head": {
      "bytes": 343572,
      "sha256": "47ffabfd103a8a4feb171b6e0085406129167c391136c7ebc8104e52953f868f"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/watch.mjs",
    "generated": true,
    "base": {
      "bytes": 414895,
      "sha256": "74b10322eb8832927b3a2d70cec9a29c0e51838deb1d326067b21ee85007120a"
    },
    "head": {
      "bytes": 419019,
      "sha256": "ad732280dfcc371f4c0a4f6845341c141d04da7e1ce910a21bd41eeea020a5da"
    }
  },
  {
    "path": "skills/session-observer/scripts/session-observer.mjs",
    "generated": true,
    "base": {
      "bytes": 484397,
      "sha256": "250cbce91c1f411dd6fd4899b32ddc367f3a609dc4635d3ff4c6ada30d5d6227"
    },
    "head": {
      "bytes": 488521,
      "sha256": "0e3cc33798be9d82ba3d5c0b7271e2c195e57392961349029b99cfbebb525532"
    }
  },
  {
    "path": "src/shared/transcript/activity/claude-code.ts",
    "generated": false,
    "base": {
      "bytes": 12425,
      "sha256": "42b86e7eda7844a2edb5b37f851fca7fea45d4e5e02a85a59daf749ca49034cb"
    },
    "head": {
      "bytes": 12228,
      "sha256": "aa1312c079173f0d0639bd55c7bff5836cacd4e8c94ab12d222634922800ef67"
    }
  },
  {
    "path": "src/shared/transcript/activity/correlate.ts",
    "generated": false,
    "base": {
      "bytes": 8602,
      "sha256": "e5586d1f491e0a9cf5d4df7d4ccc89db0a01c8f231a5a6df651f9861ea4e0106"
    },
    "head": {
      "bytes": 8713,
      "sha256": "cc2ce6b02af3f49218b1de3576355f179644913fa422bc79296bc1f16caaafc4"
    }
  },
  {
    "path": "src/shared/transcript/activity/cursor.test.ts",
    "generated": false,
    "base": {
      "bytes": 12623,
      "sha256": "680890b96db6224c912c0ad668c76862b22671874ae3804ee6cbac54707b4e34"
    },
    "head": {
      "bytes": 12635,
      "sha256": "d73876d3043671544646aa1c9198c310338f687f73b907bf13226ae3d9a1d53f"
    }
  },
  {
    "path": "src/shared/transcript/activity/cursor.ts",
    "generated": false,
    "base": {
      "bytes": 7186,
      "sha256": "bb8b90054504911980e1233a731024f2f860ee7fe5fa30c4bbb1415dbf61b61d"
    },
    "head": {
      "bytes": 7198,
      "sha256": "1454278e261e5755ed18f69f369e759c6813ba5b49d83692c990b478ab4937c4"
    }
  },
  {
    "path": "src/shared/transcript/activity/extract.test.ts",
    "generated": false,
    "base": {
      "bytes": 28504,
      "sha256": "413fd8b5fbdd4dddec275fd139c70d9f07bc855247f01811d01e97ea3afb5f6a"
    },
    "head": {
      "bytes": 29954,
      "sha256": "3a20e361cee5ff924ee4d8a4779d39c982642e1c2ff8afd05f5104ec5de0d3e8"
    }
  },
  {
    "path": "src/shared/transcript/activity/extract.ts",
    "generated": false,
    "base": {
      "bytes": 4611,
      "sha256": "bc97cd345b9cd77f5e632f7a0431c998945923b60c6195921a23b36ffe852480"
    },
    "head": {
      "bytes": 5142,
      "sha256": "42778868d0e4e957881dc64a586b306922610a4601119e1d630e88b4e9bac2d1"
    }
  },
  {
    "path": "src/shared/transcript/activity/project.test.ts",
    "generated": false,
    "base": {
      "bytes": 26840,
      "sha256": "139171b33a83da95331971a68f616ebe5818cf5528e82e6e80e873f6a7e74211"
    },
    "head": {
      "bytes": 29484,
      "sha256": "01e3b330e293689bfc05705abb704b5cb4f921ee6ae720d49ae5a8a38c018df0"
    }
  },
  {
    "path": "src/shared/transcript/activity/project.ts",
    "generated": false,
    "base": {
      "bytes": 21186,
      "sha256": "ea924803730f0f568a9caa4fbf4ae5041b065c9a855ed742e79da5d5fe43d4ef"
    },
    "head": {
      "bytes": 24288,
      "sha256": "bb7ee313025c59c354af80f87389d64c9c7fc49b8d95c2435051ba718cfd1a18"
    }
  },
  {
    "path": "src/shared/transcript/activity/render.ts",
    "generated": false,
    "base": {
      "bytes": 8880,
      "sha256": "b1cb19dd52d45796d1953b7354aa349c9d9ec3894a7de03b68c32cd28377e6f3"
    },
    "head": {
      "bytes": 8919,
      "sha256": "3391a3ab9c4f7d064ea41cf4334601853ab02e2e0353413f9714923d1a092fd8"
    }
  },
  {
    "path": "src/shared/transcript/activity/types.ts",
    "generated": false,
    "base": {
      "bytes": 11752,
      "sha256": "bd9b53bbcd79b39820d8fcaa8a492088b5efc4dd2302fc3b2fa10a8659618d61"
    },
    "head": {
      "bytes": 11834,
      "sha256": "c70ba8a5cd33c4e8fd156dc7e2e906c9e93cd4ed8e36b09c40a4afae3ac9e999"
    }
  },
  {
    "path": "src/shared/transcript/activity/usage.test.ts",
    "generated": false,
    "base": {
      "bytes": 7180,
      "sha256": "27fc90638bca0d7b66fd51521d7c2c61d76abca613f7c6bec17bac1b79da9c09"
    },
    "head": {
      "bytes": 9782,
      "sha256": "3172bbe7d16912829ce16c6b309b3ef0cedb9c3e11c43153d5c694c93b33a7e6"
    }
  },
  {
    "path": "src/shared/transcript/activity/usage.ts",
    "generated": false,
    "base": {
      "bytes": 8283,
      "sha256": "085380a4f28a55aa4471ebd30186965bdf1fff9774af5e3904ebba9d5971cc47"
    },
    "head": {
      "bytes": 9246,
      "sha256": "08f426df2c5702202f7926440cb521ed295e39339aff884161130de51a70751e"
    }
  },
  {
    "path": "src/skills/session-export-transcript/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 11604,
      "sha256": "e66343e8128f874082945e117cab3d62024735b3aef6b6ad4d973655eb21c565"
    },
    "head": {
      "bytes": 11604,
      "sha256": "11a0c9e0a63f8acf4c10ce3e01a6cc82dc17c34c26106dd3f785786bb73e4cf2"
    }
  },
  {
    "path": "src/skills/session-fork-to-destination/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 4422,
      "sha256": "1257af86c34aaf8aa3a105f16f9f0a57b5c188df42db45e2a94c53e0bb63fdd8"
    },
    "head": {
      "bytes": 4422,
      "sha256": "a9b9c92da59d7a2ab866d2705b8c16e17da9f1157d172b4cc16e090bd865674d"
    }
  },
  {
    "path": "src/skills/session-observer-collab/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 21541,
      "sha256": "4ed5181a077b02110de9eb4a1d49cc43e4ca98ff36471a5d25d79cee9f2a3e6c"
    },
    "head": {
      "bytes": 21541,
      "sha256": "95ed3832b21851590a44a0becf53bd340bd70f8c06feb5105eae8aaf40afd295"
    }
  },
  {
    "path": "src/skills/session-observer/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 48785,
      "sha256": "b3cf3ccf5964f6dfd6464180d69c6b3fa30f47c519c0c8cc1a56638b809288f5"
    },
    "head": {
      "bytes": 48785,
      "sha256": "9f6876e1aa8a940092b45aa085f7266561802b3c58379e95719e58f9895b7d5c"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/watch.ts",
    "generated": false,
    "base": {
      "bytes": 62577,
      "sha256": "6c54d2ac24de2e77d87b98c60f582207a2c855ea205df724d99d6aba1c960884"
    },
    "head": {
      "bytes": 62589,
      "sha256": "eb732cbfedb456e7d311445d918916a8df9162e1aaa2ba0b0da35d94a274188b"
    }
  }
]
```

## Authored before/after diff

```diff
diff --git a/.oat/projects/shared/session-evidence-followups/implementation.md b/.oat/projects/shared/session-evidence-followups/implementation.md
index 3bdaedb2..57151f32 100644
--- a/.oat/projects/shared/session-evidence-followups/implementation.md
+++ b/.oat/projects/shared/session-evidence-followups/implementation.md
@@ -164,8 +164,16 @@ All six findings accepted within the existing p02 scope:
 - H1: response usage must compare native thread_id, not originating session_id, against nativeSessionId. Root independently inspected a local2026-09-04 rollout:114/114 usage records have thread_id matching native header id while session_id differs. Use native-shaped regression fixtures.
 - H2: bound new optional source metadata before it can evict delivered calls/results. Preserve captured-source semantics and explicit omitted counts; do not relabel range-filtered metadata as complete source. Root confirmed event-first reduction currently reaches metadata trimming only with an empty event set. Add mixed events plus oversized metadata regression.
 - M1: apply existing Codex ownership evidence to cumulative/last-turn usage, preventing inherited parent context from appearing as child-owned usage or a reset across ownership boundaries. Preserve unknown evidence honestly; reuse narrow existing ownership rules.
 - M2: restore Skill invocation arguments under the existing preview cap. Caller args are not attachment instruction bodies; keep names-only attachment extraction. No silent redaction beyond the existing contract.
 - L1: make coverage explicitly describe source-level skill-name carriers, distinct from per-event evidence; update consumers/docs and distinguish absent carrier from a valid empty listing.
 - L2: deduplicate available names within captured source retaining a documented representative locator; keep invoked occurrences distinct. Test repeated names and invocation occurrences.
 
 Same exact Sol/high handle receives `evidence-p02-fix1-20260920`, linked to original request `evidence-p02-20260920`; bounded one-commit fix, self-review and focused checks, then independent Opus verification. Review-fix round1 of2, no implementation recovery attempts. p03 remains gated on this review resolution.
+
+### p02 fix outcome — verification pending
+
+Same Sol/high handle completed `evidence-p02-fix1-20260920` in exactly one commit `b58fd28ff6172ffdead3317c8b3ed5530a72f3c1` from `6d7ec63c9d42feb6a9423bc301e64127428969a2`; clean tree verified. All six accepted findings implemented. Native response identity uses thread_id; optional source metadata is trimmed before delivered events; Codex usage carries existing owned/inherited/unknown semantics with ownership-separated reset/model state; Skill caller arguments restored; source-skill-names coverage distinguishes native carrier availability; available names dedup with latest locator, invoked occurrences preserved. Root inspected priority search, response identity and ownership/model logic.
+
+Pre-fix regressions failed eight focused cases; final activity83/83, relevant consumers869/869, types, build/freshness, validate, baseline version closure, scoped lint/format, diff check and docs production58 pages passed. Self-review passed, no unresolved concerns. Versions observer1.0.77, export2.0.28, collab1.0.65, fork0.2.42. No implementation recovery used; one review-fix round. Independent bounded Opus verification pending; requested Opus/high remains exact user-selected route, actual runtime identity is unobserved.
+
+Additional optional Sol/medium preparation `evidence-p04-fixtures-20260920` produced external synthetic Claude/Cursor native inputs under `/tmp/evidence-p04-fixtures/` (combined sorted-content hash6e8a68cd60df099a950f23e8f57cb5bf32622543eeaa7fd7618d86c53f1526a6) and `/tmp/evidence-p04-fixture-checklist.md` (SHA25637e9d5e510bc2ef260ec877aa62bcc1f567836cd3af1931600cbff65ae74d4c7). JSON parsing passed; no repo writes, builds, exports or provider calls. Fixtures cover a subset of coverage states; p03/p04 acceptance remains pending actual frozen exports.
diff --git a/.oat/projects/shared/session-evidence-followups/plan.md b/.oat/projects/shared/session-evidence-followups/plan.md
index 954276f6..f4454955 100644
--- a/.oat/projects/shared/session-evidence-followups/plan.md
+++ b/.oat/projects/shared/session-evidence-followups/plan.md
@@ -166,17 +166,17 @@ Close each fully satisfied item via repo Backlog Lifecycle: status/updated, comp
 | p04    | code     | pending         | -          | -                             | -             | -          | -           |
 | plan | artifact | passed | 2026-09-20 | reviews/archived/plan-opus-h1-verification.md | 6863c882 | manual | claude:opus |
 | p00 | code | passed | 2026-09-20 | reviews/archived/p00-opus-review.md | - | manual | - |
 
 | p01 | code | passed | 2026-09-20 | reviews/p01-opus-fix-verification.md | - | manual | - |
 
 Spec/design rows are retained template history; quick mode uses discovery and this plan only. Full reviewed plan plus the clean bounded H1 verification establish readiness. [Complexity review](reviews/archived/complexity-review.md) retains the minimum sufficient approach. The subsequently user-requested 600→900 timeout task is a narrow operational addition; its requirements are explicit above and it receives self-review and independent Opus code review, without repeating the unchanged six-ticket plan review.
 
-| p02 | code | changes_requested | 2026-09-20 | reviews/p02-opus-review.md | 8094b2df | consensus | claude:opus |
+| p02 | code | fixes_completed | 2026-09-20 | reviews/p02-opus-review.md | 8094b2df | consensus | claude:opus |
 
 ## Implementation Complete
 
 Phases 0–1 implemented and independently reviewed. Phase2 implemented, independent review pending. Phase 0: 1 task; Phase 1: 2 tasks; Phase 2: 2 tasks; Phase 3: 1 task; Phase 4: 1 task. **Total: 7 tasks, 5 complete.** Final acceptance/delivery remains mandatory after product phases.
 
 ## References
 
 - [Discovery](discovery.md)
diff --git a/.oat/projects/shared/session-evidence-followups/project-log.md b/.oat/projects/shared/session-evidence-followups/project-log.md
index d38e93e6..5c7d87bc 100644
--- a/.oat/projects/shared/session-evidence-followups/project-log.md
+++ b/.oat/projects/shared/session-evidence-followups/project-log.md
@@ -47,11 +47,15 @@ p00 passed independent Consensus review 8c84e955-3f2e-4817-afd8-a7d08531875b; no
 ### 2026-09-20 · structural · oat-project-implement · p01
 
 p01 passed full and bounded independent Opus reviews; one nonblocking fix round plus docs clarification; review c47f8d9e-a43b-48e3-b790-fdf445abf041, evidence in implementation.md.
 
 ### 2026-09-20 · structural · oat-project-implement · p02
 
 evidence-p02-outcome-20260920: two Sol task commits verified; phase checks and self-review pass, independent Opus review pending; see implementation.md.
 
+### 2026-09-20 · structural · oat-project-implement · p02-fix1
+
+evidence-p02-fix1-outcome-20260920: six accepted findings fixed by same Sol handle; self-review and checks pass, independent verification pending; see implementation.md.
+
 ## End-of-run synthesis (pending — do not skip at project completion)
 
 Summarize the overall verdict, adopted adjustments, and entries graduated to the repo ledger or backlog. Roll up durable observations into tracked surfaces before archiving this project log.
diff --git a/.oat/projects/shared/session-evidence-followups/state.md b/.oat/projects/shared/session-evidence-followups/state.md
index d9afacdf..f9ea1335 100644
--- a/.oat/projects/shared/session-evidence-followups/state.md
+++ b/.oat/projects/shared/session-evidence-followups/state.md
@@ -1,11 +1,11 @@
 ---
 oat_current_task: p03-t01
-oat_last_commit: 92b688f9fa95cd5bd8bc9d4d6267c995134ecdfa
+oat_last_commit: b58fd28ff6172ffdead3317c8b3ed5530a72f3c1
 oat_blockers: []
 associated_issues:
   - { type: backlog, ref: 'BL-260919-stabilize-the-watcher-sigterm' }
   - { type: backlog, ref: 'BL-260919-surface-terminally' }
   - { type: backlog, ref: 'BL-260919-skill-attribution-in-session' }
   - { type: backlog, ref: 'BL-260919-token-and-usage-accounting' }
   - { type: backlog, ref: 'BL-260919-uncapped-structured-activity' }
   - { type: backlog, ref: 'BL-260919-session-retro-consume-activity' }
@@ -99,17 +99,17 @@ oat_generated: false
 # Project State: session-evidence-followups
 
 **Status:** Implementation
 **Started:** 2026-09-20
 **Last Updated:** 2026-09-20
 
 ## Current Phase
 
-p00 and p01 complete and independently reviewed. p02 skill/usage implementation complete; independent Opus review requested fixes; bounded Sol correction is next before p03. User authorized continuation through one mergeable PR.
+p00 and p01 complete and independently reviewed. p02 skill/usage implementation complete; accepted Opus findings are fixed; independent bounded verification is next before p03. User authorized continuation through one mergeable PR.
 
 ## Artifacts
 
 - **Discovery:** `discovery.md` (complete)
 - **Spec:** N/A (quick mode)
 - **Design:** N/A (quick mode unless lightweight design is needed)
 - **Plan:** `plan.md` (complete and reviewed)
 - **Implementation:** `implementation.md` (5/7 tasks complete)
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d5496415..7c574cd0 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,12 +1,22 @@
 # Changelog
 
 ## [Unreleased]
 
+### Fixed
+
+- `session-observer` 1.0.77 and `session-export-transcript` 2.0.28 preserve
+  delivered activity before optional source metadata under byte pressure,
+  identify Codex response usage by native thread, keep usage ownership and
+  model/reset boundaries honest, retain bounded Claude `Skill` caller input,
+  and make source-name coverage and deduplication explicit.
+  `session-observer-collab` 1.0.65 and `session-fork-to-destination` 0.2.42
+  receive validation-only shared-runtime version closure.
+
 ### Added
 
 - `session-observer` 1.0.76 and `session-export-transcript` 2.0.27 add
   captured-source token metadata with exact Claude Code message deduplication,
   separate Codex cumulative, last-turn, and response semantics, explicit reset
   and uncertainty diagnostics, model attribution only from native joins, and
   Cursor `not-recorded` status. `session-observer-collab` 1.0.64 and
   `session-fork-to-destination` 0.2.41 receive the shared runtime closure while
diff --git a/documentation/docs/engineering/architecture/session-schemas/claude-code.md b/documentation/docs/engineering/architecture/session-schemas/claude-code.md
index a47a751e..4ef34440 100644
--- a/documentation/docs/engineering/architecture/session-schemas/claude-code.md
+++ b/documentation/docs/engineering/architecture/session-schemas/claude-code.md
@@ -350,22 +350,26 @@ tail carries the structural signals cited elsewhere on this page, including
 `attributionSkill` 9,800, `attributionMcpServer` / `attributionMcpTool` 82,
 `attributionPlugin` 22, `advisorModel` 373. **Slash commands** have no structured record
 type: they appear as `user.message.content` strings containing `<command-name>` (130
 files) and `<local-command-stdout>` (70), and as `system` records with
 `subtype: local_command` (40).
 
 `attributionSkill` is a top-level assistant-record field, not a member of
 `message`. A `tool_use` whose native name is `Skill` is separate structural
-invocation evidence, and its structured input may name the skill. Names-only
+invocation evidence, and its full caller-supplied structured input remains
+ordinary bounded call input. It is distinct from attachment instruction
+content, which is not copied into skill metadata. Names-only
 source metadata also appears in `attachment.type == "skill_listing"` at
 `attachment.names[]` (availability) and `attachment.type == "invoked_skills"`
 at `attachment.skills[].name` (recorded invocation). Attachment content and path
-bodies are not needed for these names. None of these carriers records a skill
-version.
+bodies are not needed for these names. Available names are deduplicated within
+the captured source using the latest recorded locator; invoked names remain per
+occurrence. `source-skill-names` coverage distinguishes a valid empty listing
+from an absent carrier. None of these carriers records a skill version.
 
 ## 9. Externally persisted output and sizes
 
 Large Bash output is written to a sidecar file and referenced two ways that do not carry
 the same information. In the transcript text, the `tool_result` content contains a bare
 `<persisted-output>` marker (270 occurrences in the sample; no attributes observed on the
 tag). The **path** appears only in the sibling `toolUseResult.persistedOutputPath`,
 alongside `persistedOutputSize` — 254 carriers, all on `Bash`. A reader consuming only
diff --git a/documentation/docs/engineering/architecture/session-schemas/codex.md b/documentation/docs/engineering/architecture/session-schemas/codex.md
index 11915db0..00f0b664 100644
--- a/documentation/docs/engineering/architecture/session-schemas/codex.md
+++ b/documentation/docs/engineering/architecture/session-schemas/codex.md
@@ -329,20 +329,24 @@ mentions are not equivalent evidence.
 The cumulative counter is not strictly monotonic: it rose in 46,450 of 46,523
 comparisons, and all 73 decreases sit at compaction boundaries. A reader that assumes
 monotonicity will compute negative deltas at exactly those points; treat a decrease as a
 compaction signal, not as corrupt data.
 
 The activity reader preserves `total_token_usage`, `last_token_usage`, and
 `token_usage_record` as separate semantics. Identical token-count snapshots are
 collapsed; a cumulative decrease starts a numbered segment and emits a reset
-diagnostic rather than a negative delta. Response usage can inherit a model only
-when its recorded `turn_id` joins a `turn_context`; totals and last-turn records
-remain model-unknown when no native join exists. No counter is converted to
-price or cost.
+diagnostic rather than a negative delta. Cumulative and last-turn samples use
+the native subagent history boundary to remain `owned`, `inherited`, or
+`unknown`; reset state never crosses between those ownership classes. Response
+usage matches `thread_id` to the selected native transcript identity, while its
+distinct `session_id` is root-session context. A response can inherit a model
+only when its recorded `turn_id` joins a `turn_context` with the same ownership;
+totals and last-turn records remain model-unknown when no native join exists. No
+counter is converted to price or cost.
 
 ## Output size limits
 
 | Measurement                         | Value                                                         |
 | ----------------------------------- | ------------------------------------------------------------- |
 | Response-item output payload size   | p50 920 B · p99 40,147 B · max 399,386 B; none exceeded 1 MB. |
 | `item.stdout` / `aggregated_output` | Peak at exactly **1,048,608 bytes** across independent files. |
 | `formatted_output`                  | Peaks at exactly **40,109 bytes** across independent files.   |
diff --git a/documentation/docs/engineering/architecture/session-schemas/cursor.md b/documentation/docs/engineering/architecture/session-schemas/cursor.md
index 42bc627b..ac878058 100644
--- a/documentation/docs/engineering/architecture/session-schemas/cursor.md
+++ b/documentation/docs/engineering/architecture/session-schemas/cursor.md
@@ -300,16 +300,19 @@ structured `questions[]` / `options[]`.
 `src/shared/transcript/cursor-frames.ts` is **uncontradicted** by this evidence. The two
 Cursor claims in `10-schema-guide-and-coverage.md` are supported.
 
 ## Not observed / not determined
 
 - `status: "cancelled"` — not observed in 350 files.
 - Any tool result, call id, or per-call outcome — not present corpus-wide.
 - Any timestamp, usage, model, or version metadata — not present.
+- Any source-level skill-name listing — not present. Activity coverage reports
+  `source-skill-names` as `not-recorded` independently from inferred per-call
+  `SKILL.md` read evidence.
 - The activity reader therefore reports token usage as `not-recorded`, never as
   a numeric zero.
 - Streaming, partial, or superseded-revision markers — not present in settled files.
 - Attribution of an `agent-tools/` file to the call that produced it — not recoverable.
 - Whether a file is one conversation or one turn — undetermined.
 - Whether the ~15 KB spill threshold is real — inferred, not confirmed.
 - Shape drift across Cursor versions — untestable, since no version field exists.
 
diff --git a/documentation/docs/engineering/architecture/session-schemas/index.md b/documentation/docs/engineering/architecture/session-schemas/index.md
index 6a250bf8..97427e48 100644
--- a/documentation/docs/engineering/architecture/session-schemas/index.md
+++ b/documentation/docs/engineering/architecture/session-schemas/index.md
@@ -62,19 +62,29 @@ these files, and they change between client releases.
   instruction bodies to manufacture a skill load.
 
 None of the three native transcript formats records a skill version. An
 installed-file or Git revision selected for the transcript timestamp is inferred
 context, may be unknown, and cannot prove the revision that executed.
 
 The activity reader keeps usage as captured-source metadata. It deduplicates
 Claude Code by exact session and `message.id`, keeps Codex cumulative,
-last-turn, and response-joinable records separate, and reports Cursor usage as
-`not-recorded`. It never treats a missing counter as zero or converts tokens to
-money.
+last-turn, and response-joinable records separate, and labels Codex samples by
+native ownership without carrying reset state or model joins across ownership
+boundaries. Response identity uses native `thread_id`; `session_id` remains root
+context. Cursor usage is `not-recorded`. It never treats a missing counter as
+zero or converts tokens to money.
+
+Source-level skill-name coverage uses `source-skill-names`, separate from
+per-event attribution, invocation, or inferred file-read evidence. Claude Code
+empty listings are available with zero captured names, absent carriers are
+`not-recorded`, available names retain the latest locator per name, and invoked
+names remain per occurrence. Optional captured-source skill and usage metadata
+is reduced before delivered event groups when a report reaches its byte budget;
+omission counts retain the complete captured-source totals.
 
 ## Repository parser support
 
 The repository now has tested opt-in activity readers for the three documented
 transcript surfaces. This implementation status does not strengthen or extend
 the native-format observations on these pages.
 
 | Runtime     | Tested activity support                                                                                                                                       |
diff --git a/documentation/docs/user-guide/skills/session-export-transcript.md b/documentation/docs/user-guide/skills/session-export-transcript.md
index 0ec81a09..6edb2131 100644
--- a/documentation/docs/user-guide/skills/session-export-transcript.md
+++ b/documentation/docs/user-guide/skills/session-export-transcript.md
@@ -77,37 +77,47 @@ The export activity budget is 64 MiB for the rendered report, with no
 invocation-count cap and a 2 KiB preview per value. The shared projection also
 reserves 256 bytes for late-call context, although a normal full-session export
 starts at zero and includes the call itself. Source and delivery ranges,
 locators, captured/delivered/displayed counts, omissions, coverage, and
 diagnostics remain explicit.
 
 The report keeps native tool names and adds typed skill evidence when the
 transcript supplies it. Claude Code attribution, structured `Skill`
-invocations, and names-only skill attachments stay distinct. Cursor `Read` and
+invocations, and names-only skill attachments stay distinct. A native `Skill`
+call retains caller-supplied input under the normal preview cap; attachment
+instruction content is not copied. Available source names are deduplicated by
+name at their latest locator, invoked names remain per occurrence, and
+`source-skill-names` coverage distinguishes an empty native listing from an
+absent carrier. Cursor `Read` and
 `ReadFile` calls can supply inferred `SKILL.md` file-load evidence from their
 structured `path`. Historical Codex transcripts can supply the inference only
 from the exact experimental `read_file.file_path` carrier; upstream removed the
 tool in March 2026, and it is absent from the recent local sample. Shell
 commands, aliases, and prose are never treated as skill loads. Source-wide skill
 names are labelled `captured-source` and participate in the report byte budget
-with explicit omission counts.
+with explicit omission counts. Optional source metadata is trimmed before
+delivered calls and results are removed.
 
 The supported runtimes do not record a skill version. A timestamp-relevant
 installed-file or Git lookup is inferred context, can remain unknown, and is
 not proof of the revision that executed.
 
 Captured-source token metadata preserves the runtime's semantics rather than
 combining unlike counters. Claude Code repeats of one `message.id` are
 deduplicated within the exact native session, conflicts are diagnosed, and
 missing IDs remain uncertain. Codex cumulative, last-turn, and
 response-joinable records stay separate; counter decreases mark reset segments,
-and models are attached only through recorded turn evidence. Cursor usage is
-`not-recorded`, not zero. The report emits token fields without pricing or cost
-estimates and explicitly counts usage metadata omitted by its byte budget.
+and samples retain `owned`, `inherited`, or `unknown` lineage. Reset state and
+model joins cannot cross an ownership boundary. Response records match the
+native thread through `thread_id`, while their separate `session_id` remains
+root-session context. Models are attached only through recorded turn evidence
+with matching ownership. Cursor usage is `not-recorded`, not zero. The report
+emits token fields without pricing or cost estimates and explicitly counts
+usage metadata omitted by its byte budget.
 
 Activity previews can contain commands, paths, identifiers, tool inputs, and
 tool outputs even though the conversation section remains sanitized. The
 exporter does not open Claude persisted-output sidecars, Cursor `agent-tools/`
 files, or Claude, Codex, or Cursor child transcripts. Schema v1 emits explicit
 `not-read` coverage for persisted-output references recorded by Claude and child
 IDs recorded by Claude or Codex. Cursor `agent-tools/` and child-transcript
 surfaces have no dedicated per-reference schema-v1 coverage entry. Extraction
diff --git a/documentation/docs/user-guide/skills/session-observer.md b/documentation/docs/user-guide/skills/session-observer.md
index f8dcbcc1..7a39e145 100644
--- a/documentation/docs/user-guide/skills/session-observer.md
+++ b/documentation/docs/user-guide/skills/session-observer.md
@@ -67,40 +67,53 @@ Activity has a separate fixed budget from the conversation controls:
 
 The report distinguishes captured-source, delivered-range, and displayed
 counts. Its omission counts, coverage, diagnostics, and source locators explain
 what was bounded or unavailable. A result whose call occurred before the
 delivered range can retain a small `outside-delivered-range` call context
 without replaying the call as new activity.
 
 Skill evidence is additive to the native tool name. Claude Code can record a
-top-level skill attribution or a structured `Skill` invocation; captured-source
-attachments separately distinguish available skill names from recorded invoked
-names. Cursor contributes inferred load evidence only when a recorded `Read` or
+top-level skill attribution or a structured `Skill` invocation. The native
+`Skill` call retains its caller-supplied input under the ordinary preview cap;
+instruction content in source attachments is not copied into the report.
+Captured-source attachments separately distinguish available skill names from
+recorded invoked names. Available names are deduplicated by name with the latest
+recorded locator retained, while invoked names remain per occurrence. Coverage
+uses the explicit `source-skill-names` class, so a valid empty native listing is
+`available` with zero names and an absent listing is `not-recorded`; event-level
+skill evidence remains independent. Cursor contributes inferred load evidence
+only when a recorded `Read` or
 `ReadFile` call has a structured `path` ending in `SKILL.md`. Historical Codex
 transcripts can contribute the same inference only through the exact
 experimental `read_file` function's structured `file_path`; upstream removed
 that native tool in March 2026, and it was absent from the recent local sample.
 Current shell reads, aliases, and prose mentions are not parsed. Captured-source
 skill metadata can describe records outside the delivered range and is labelled
-accordingly; the report counts any entries removed by its byte budget.
+accordingly. Optional source metadata is trimmed before delivered calls and
+results compete for the report byte budget, and exact omission counts preserve
+the captured-source totals.
 
 None of these runtimes records the executed skill version. Looking up an
 installed file or Git revision relevant to the transcript timestamp is an
 inference, may be unavailable, and does not prove which revision executed.
 
 Token usage is also captured-source metadata. Claude Code usage is deduplicated
 by exact native session and `message.id`; conflicting repeats are diagnosed and
 missing IDs remain explicitly uncertain. Codex cumulative totals, last-turn
 usage, and response-joinable usage remain separate samples. Repeated snapshots
 collapse, decreases start a new segment instead of producing negative usage,
-and a model appears only when a native turn join supports it. Cursor reports
-usage as `not-recorded`, never zero. Reports contain token fields only and do
-not estimate price or cost. Usage samples and diagnostics participate in the
-activity byte budget with explicit omission counts.
+and each sample is labelled `owned`, `inherited`, or `unknown` from the same
+native lineage boundary used for activity. Reset state and model joins do not
+cross that boundary. Response usage is matched to the transcript's native
+`thread_id`; its distinct `session_id` remains root-session context. A model
+appears only when a native turn join with matching ownership supports it.
+Cursor reports usage as `not-recorded`, never zero. Reports contain token fields
+only and do not estimate price or cost. Usage samples and diagnostics
+participate in the activity byte budget with explicit omission counts.
 
 Claude Code and Codex conversation and activity come from one detailed read.
 Cursor uses one physical-frame scan. `review` is a stateless full snapshot and
 does not move the high-water mark unless `--mark-read` is also present.
 Catch-up and watch share the ordinary delivery checkpoint; activity has no
 separate cursor.
 
 For Cursor, stateful activity waits for terminal settlement. A later
diff --git a/src/shared/transcript/activity/claude-code.ts b/src/shared/transcript/activity/claude-code.ts
index 69bed121..0a8d4bb8 100644
--- a/src/shared/transcript/activity/claude-code.ts
+++ b/src/shared/transcript/activity/claude-code.ts
@@ -40,29 +40,16 @@ function claudeSkillEvidence(
     evidence.push({
       kind: 'native-invocation',
       ...(name === undefined ? {} : { name }),
     });
   }
   return evidence.length === 0 ? undefined : evidence;
 }
 
-function claudeToolArguments(
-  nativeName: string | undefined,
-  input: unknown,
-): unknown {
-  if (nativeName !== 'Skill') return input;
-  if (!isJsonObject(input)) return undefined;
-  const skill = nonEmptyString(input.skill);
-  const name = nonEmptyString(input.name);
-  if (skill !== undefined) return { skill };
-  if (name !== undefined) return { name };
-  return undefined;
-}
-
 function claudeSourceSkills(
   detailed: DetailedTranscriptRecord,
 ): ActivitySourceSkill[] {
   const { record } = detailed;
   if (record.type !== 'attachment' || !isJsonObject(record.attachment)) {
     return [];
   }
   const attachment = record.attachment;
@@ -287,16 +274,21 @@ export function extractClaudeRecord(
   const { record } = detailed;
   const events: ExtractedActivityEvent[] = [];
   const coverage: ExtractedRecordActivity['coverage'] = [];
   const message = isJsonObject(record.message) ? record.message : undefined;
   const content = message?.content;
   const provenance = claudeUserRecordProvenance(record);
   const systemActivity = claudeSystemActivity(source, detailed);
   const sourceSkills = claudeSourceSkills(detailed);
+  const sourceSkillNamesRecorded =
+    record.type === 'attachment' &&
+    isJsonObject(record.attachment) &&
+    record.attachment.type === 'skill_listing' &&
+    Array.isArray(record.attachment.names);
 
   if (systemActivity) events.push(systemActivity);
 
   if (record.type === 'assistant') {
     const metadata = selectedClaudeMetadata(record);
     if (metadata) {
       const locator = recordLocator(detailed, '/message');
       events.push({
@@ -320,29 +312,26 @@ export function extractClaudeRecord(
       const locator = recordLocator(detailed, `/message/content/${blockIndex}`);
 
       if (blockType === 'tool_use') {
         const nativeCallId = stringValue(candidate.id);
         const nativeName = stringValue(candidate.name);
         const input = Object.hasOwn(candidate, 'input')
           ? candidate.input
           : undefined;
-        const argumentsValue = claudeToolArguments(nativeName, input);
         const skillEvidence = claudeSkillEvidence(record, nativeName, input);
         events.push({
           eventKey: eventKey(source, locator),
           kind: 'call',
           nativeType: blockType,
           locator,
           outcome: 'pending',
           ...(nativeCallId === undefined ? {} : { nativeCallId }),
           ...(nativeName === undefined ? {} : { nativeName }),
-          ...(argumentsValue === undefined
-            ? {}
-            : { arguments: argumentsValue }),
+          ...(input === undefined ? {} : { arguments: input }),
           ...(skillEvidence === undefined ? {} : { skillEvidence }),
         });
         return;
       }
 
       if (blockType === 'tool_result') {
         const nativeCallId = stringValue(candidate.tool_use_id);
         const result = Object.hasOwn(candidate, 'content')
@@ -387,10 +376,16 @@ export function extractClaudeRecord(
       kind: 'notification',
       nativeType: 'task-notification',
       locator,
       outcome: 'unknown',
       origin: provenance,
     });
   }
 
-  return { events, coverage, diagnostics: [], sourceSkills };
+  return {
+    events,
+    coverage,
+    diagnostics: [],
+    sourceSkills,
+    ...(sourceSkillNamesRecorded ? { sourceSkillNamesRecorded: true } : {}),
+  };
 }
diff --git a/src/shared/transcript/activity/correlate.ts b/src/shared/transcript/activity/correlate.ts
index 4cc359db..134bb18f 100644
--- a/src/shared/transcript/activity/correlate.ts
+++ b/src/shared/transcript/activity/correlate.ts
@@ -8,17 +8,17 @@ import type {
   CorrelatedActivity,
   CorrelatedActivityEvent,
   ExtractedActivity,
   ExtractedActivityEvent,
 } from './types.js';
 
 type CallLookup = ReadonlyMap<string, readonly ExtractedActivityEvent[]>;
 
-interface OwnershipContext {
+export interface ActivityOwnershipContext {
   kind: 'root' | 'bounded-child' | 'unknown';
   boundary?: number;
 }
 
 interface HeaderOwnershipEvidence {
   kind: 'root' | 'bounded-child' | 'unknown';
   boundary?: number;
   parentThreadId?: string;
@@ -69,25 +69,26 @@ function headerOwnershipEvidence(
     !Number.isSafeInteger(boundary) ||
     boundary < 0
   ) {
     return { kind: 'unknown' };
   }
   return { kind: 'bounded-child', boundary, parentThreadId };
 }
 
-function ownershipContext(activity: ExtractedActivity): OwnershipContext {
-  if (activity.source.runtime !== 'codex') return { kind: 'root' };
-  const headers = activity.events.filter((event) => {
+export function activityOwnershipContext(
+  source: ExtractedActivity['source'],
+  events: readonly ExtractedActivityEvent[],
+): ActivityOwnershipContext {
+  if (source.runtime !== 'codex') return { kind: 'root' };
+  const headers = events.filter((event) => {
     if (event.kind !== 'metadata' || event.nativeType !== 'session_meta') {
       return false;
     }
-    return (
-      metadataObject(event)?.nativeSessionId === activity.source.nativeSessionId
-    );
+    return metadataObject(event)?.nativeSessionId === source.nativeSessionId;
   });
   if (headers.length === 0) return { kind: 'unknown' };
 
   const evidence = headers.map(headerOwnershipEvidence);
   if (evidence.every((entry) => entry.kind === 'root')) return { kind: 'root' };
   if (evidence.some((entry) => entry.kind !== 'bounded-child')) {
     return { kind: 'unknown' };
   }
@@ -99,31 +100,29 @@ function ownershipContext(activity: ExtractedActivity): OwnershipContext {
     return { kind: 'unknown' };
   }
   return {
     kind: 'bounded-child',
     boundary: evidence[0].boundary,
   };
 }
 
-function ownershipFor(
-  event: ExtractedActivityEvent,
-  context: OwnershipContext,
+export function ownershipForLocator(
+  locator: ExtractedActivityEvent['locator'],
+  context: ActivityOwnershipContext,
 ): ActivityOwnership {
   if (context.kind === 'root') return 'owned';
   if (
     context.kind === 'unknown' ||
-    typeof event.locator.ordinal !== 'number' ||
-    !Number.isSafeInteger(event.locator.ordinal)
+    typeof locator.ordinal !== 'number' ||
+    !Number.isSafeInteger(locator.ordinal)
   ) {
     return 'unknown';
   }
-  return event.locator.ordinal < (context.boundary as number)
-    ? 'inherited'
-    : 'owned';
+  return locator.ordinal < (context.boundary as number) ? 'inherited' : 'owned';
 }
 
 function callsBy(
   calls: readonly ExtractedActivityEvent[],
   field: 'nativeCallId' | 'nativeId',
 ): Map<string, ExtractedActivityEvent[]> {
   const lookup = new Map<string, ExtractedActivityEvent[]>();
   for (const call of calls) {
@@ -240,26 +239,26 @@ function correlationCounts(
         .length,
     },
   };
 }
 
 export function correlateActivity(
   activity: ExtractedActivity,
 ): CorrelatedActivity {
-  const context = ownershipContext(activity);
+  const context = activityOwnershipContext(activity.source, activity.events);
   const calls = activity.events.filter((event) => event.kind === 'call');
   const byCallId = callsBy(calls, 'nativeCallId');
   const byNativeId = callsBy(calls, 'nativeId');
   const events = activity.events.map((event): CorrelatedActivityEvent => {
     const related = relatedCall(event, byCallId, byNativeId);
     const category = categoryFor(event, related);
     return {
       ...event,
-      ownership: ownershipFor(event, context),
+      ownership: ownershipForLocator(event.locator, context),
       ...(category === undefined ? {} : { category }),
       ...(related === undefined ? {} : { relatedCallKey: related.eventKey }),
     };
   });
 
   return {
     ...activity,
     events,
diff --git a/src/shared/transcript/activity/cursor.test.ts b/src/shared/transcript/activity/cursor.test.ts
index 3240d412..c5aa1112 100644
--- a/src/shared/transcript/activity/cursor.test.ts
+++ b/src/shared/transcript/activity/cursor.test.ts
@@ -128,17 +128,17 @@ describe('extractCursorActivity', () => {
           kind: 'inferred-file-read',
           name: 'one',
           path: '/fixture/skills/one/SKILL.md',
         },
       ],
     });
     expect(activity.events[1]).not.toHaveProperty('skillEvidence');
     expect(activity.coverage).toContainEqual({
-      dataClass: 'skills',
+      dataClass: 'source-skill-names',
       status: 'not-recorded',
       captured: 0,
     });
     expect(activity.sourceMetadata?.usage).toEqual({
       scope: 'captured-source',
       availability: 'not-recorded',
       samples: [],
       diagnostics: [],
diff --git a/src/shared/transcript/activity/cursor.ts b/src/shared/transcript/activity/cursor.ts
index 7a99e880..91ac460d 100644
--- a/src/shared/transcript/activity/cursor.ts
+++ b/src/shared/transcript/activity/cursor.ts
@@ -170,17 +170,17 @@ function coverage(
 ): ActivityCoverageEntry[] {
   const entries: ActivityCoverageEntry[] = [
     {
       dataClass: 'calls',
       status: 'available',
       captured: events.length,
     },
     {
-      dataClass: 'skills',
+      dataClass: 'source-skill-names',
       status: 'not-recorded',
       captured: 0,
     },
     ...(events.length > 0 || mode === 'stateless-snapshot'
       ? [
           {
             dataClass: 'results' as const,
             status: 'not-recorded' as const,
diff --git a/src/shared/transcript/activity/extract.test.ts b/src/shared/transcript/activity/extract.test.ts
index 1aa3e6dd..229d1aef 100644
--- a/src/shared/transcript/activity/extract.test.ts
+++ b/src/shared/transcript/activity/extract.test.ts
@@ -50,17 +50,20 @@ describe('Claude Code activity extraction', () => {
           type: 'assistant',
           attributionSkill: 'session-observer',
           message: {
             content: [
               {
                 type: 'tool_use',
                 id: 'skill-call',
                 name: 'Skill',
-                input: { skill: 'session-observer', body: 'private sentinel' },
+                input: {
+                  skill: 'session-observer',
+                  args: 'caller invocation input',
+                },
               },
               { type: 'tool_use', id: 'read-call', name: 'Read', input: {} },
             ],
           },
         },
         0,
       ),
       detailed(
@@ -83,68 +86,124 @@ describe('Claude Code activity extraction', () => {
             skills: [
               { name: 'invoked-one', content: 'private invoked sentinel' },
               { name: 42 },
             ],
           },
         },
         2,
       ),
+      detailed(
+        {
+          type: 'attachment',
+          attachment: {
+            type: 'skill_listing',
+            names: ['available-one'],
+          },
+        },
+        3,
+      ),
+      detailed(
+        {
+          type: 'attachment',
+          attachment: {
+            type: 'invoked_skills',
+            skills: [{ name: 'invoked-one' }],
+          },
+        },
+        4,
+      ),
     ];
 
     const extracted = extractActivity({
       source: CLAUDE_SOURCE,
       read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
     });
 
     expect(extracted.events[0]).toMatchObject({
       nativeName: 'Skill',
+      arguments: {
+        skill: 'session-observer',
+        args: 'caller invocation input',
+      },
       skillEvidence: [
         { kind: 'native-attribution', name: 'session-observer' },
         { kind: 'native-invocation', name: 'session-observer' },
       ],
     });
     expect(extracted.events[1]).toMatchObject({
       nativeName: 'Read',
       skillEvidence: [{ kind: 'native-attribution', name: 'session-observer' }],
     });
     expect(extracted.sourceMetadata).toMatchObject({
       scope: 'captured-source',
       skills: [
-        expect.objectContaining({
-          evidence: 'available',
-          name: 'available-one',
-          locator: expect.objectContaining({
-            jsonPointer: '/attachment/names/0',
-          }),
-        }),
         expect.objectContaining({
           evidence: 'available',
           name: 'available-two',
           locator: expect.objectContaining({
             jsonPointer: '/attachment/names/3',
           }),
         }),
         expect.objectContaining({
           evidence: 'invoked',
           name: 'invoked-one',
           locator: expect.objectContaining({
             jsonPointer: '/attachment/skills/0/name',
           }),
         }),
+        expect.objectContaining({
+          evidence: 'available',
+          name: 'available-one',
+          locator: expect.objectContaining({
+            jsonPointer: '/attachment/names/0',
+            recordIndex: 3,
+          }),
+        }),
+        expect.objectContaining({
+          evidence: 'invoked',
+          name: 'invoked-one',
+          locator: expect.objectContaining({ recordIndex: 4 }),
+        }),
       ],
     });
     const serialized = JSON.stringify(extracted.sourceMetadata);
     expect(serialized).not.toContain('private');
     expect(serialized).not.toContain('/private/listing/path');
     expect(JSON.stringify(extracted)).not.toContain('private sentinel');
     expect(extracted.coverage).toContainEqual({
-      dataClass: 'skills',
+      dataClass: 'source-skill-names',
       status: 'available',
-      captured: 3,
+      captured: 2,
+    });
+  });
+
+  it('distinguishes an empty native skill listing from no source listing', () => {
+    const extracted = extractActivity({
+      source: CLAUDE_SOURCE,
+      read: {
+        ...TEST_SNAPSHOT,
+        records: [
+          detailed(
+            {
+              type: 'attachment',
+              attachment: { type: 'skill_listing', names: [] },
+            },
+            0,
+          ),
+        ],
+        diagnostics: [],
+      },
+    });
+
+    expect(extracted.sourceMetadata?.skills).toEqual([]);
+    expect(extracted.coverage).toContainEqual({
+      dataClass: 'source-skill-names',
+      status: 'available',
+      captured: 0,
     });
   });
 
   it('extracts multiblock calls, result carriers, persisted output, and notifications', async () => {
     const read = await readRecordsDetailed(CLAUDE_SOURCE.transcriptPath);
     const extracted = extractActivity({
       source: CLAUDE_SOURCE,
       read,
@@ -153,17 +212,17 @@ describe('Claude Code activity extraction', () => {
     expect(extracted.activitySchemaVersion).toBe(1);
     expect(extracted.source).toEqual(CLAUDE_SOURCE);
     expect(extracted.sourceSnapshot).toEqual({
       capturedAt: read.capturedAt,
       sourceBytes: read.sourceBytes,
     });
     expect(extracted.diagnostics).toEqual([]);
     expect(extracted.coverage).toContainEqual({
-      dataClass: 'skills',
+      dataClass: 'source-skill-names',
       status: 'not-recorded',
       captured: 0,
     });
 
     const calls = extracted.events.filter((event) => event.kind === 'call');
     expect(calls.map((event) => event.nativeName)).toEqual([
       'Read',
       'Bash',
@@ -530,17 +589,17 @@ describe('Codex activity extraction', () => {
         },
       ],
     });
     expect(extracted.events[1]).not.toHaveProperty('skillEvidence');
     expect(extracted.events[2]).not.toHaveProperty('skillEvidence');
     expect(extracted.events[3]).not.toHaveProperty('skillEvidence');
     expect(JSON.stringify(extracted)).not.toContain('private-prose');
     expect(extracted.coverage).toContainEqual({
-      dataClass: 'skills',
+      dataClass: 'source-skill-names',
       status: 'not-recorded',
       captured: 0,
     });
   });
 
   it('extracts native response carriers, standalone items, child ids, and metadata', async () => {
     const read = await readRecordsDetailed(CODEX_SOURCE.transcriptPath);
     const extracted = extractActivity({
diff --git a/src/shared/transcript/activity/extract.ts b/src/shared/transcript/activity/extract.ts
index c7188caa..27bc3623 100644
--- a/src/shared/transcript/activity/extract.ts
+++ b/src/shared/transcript/activity/extract.ts
@@ -84,16 +84,17 @@ function extractionFailure(locator: ActivityLocator): ExtractedRecordActivity {
 export function extractActivity(
   input: ExtractActivityInput,
 ): ExtractedActivity {
   validateInput(input);
   const events: ExtractedActivity['events'] = [];
   const coverage: ExtractedActivity['coverage'] = [];
   const diagnostics: ExtractedActivity['diagnostics'] = [];
   const sourceSkills: ActivitySourceSkill[] = [];
+  let sourceSkillNamesRecorded = false;
   let usage = notRecordedUsage();
 
   for (const sourceDiagnostic of input.read.diagnostics) {
     const locator: ActivityLocator = {
       physicalLine: sourceDiagnostic.physicalLine,
       jsonPointer: '',
     };
     diagnostics.push({
@@ -121,44 +122,55 @@ export function extractActivity(
         physicalLine: detailed.physicalLine,
         jsonPointer: '',
       });
     }
     events.push(...extracted.events);
     coverage.push(...extracted.coverage);
     diagnostics.push(...extracted.diagnostics);
     sourceSkills.push(...(extracted.sourceSkills ?? []));
+    sourceSkillNamesRecorded ||= extracted.sourceSkillNamesRecorded === true;
   }
 
+  const latestAvailableSkill = new Map<string, ActivitySourceSkill>();
+  for (const skill of sourceSkills) {
+    if (skill.evidence === 'available')
+      latestAvailableSkill.set(skill.name, skill);
+  }
+  const deduplicatedSourceSkills = sourceSkills.filter(
+    (skill) =>
+      skill.evidence === 'invoked' ||
+      latestAvailableSkill.get(skill.name) === skill,
+  );
+
   try {
-    usage = extractUsageMetadata(input.source, input.read.records);
+    usage = extractUsageMetadata(input.source, input.read.records, events);
   } catch {
     usage = notRecordedUsage();
   }
 
   return {
     activitySchemaVersion: ACTIVITY_SCHEMA_VERSION,
     source: input.source,
     sourceSnapshot: {
       capturedAt: input.read.capturedAt,
       sourceBytes: input.read.sourceBytes,
     },
     events,
     diagnostics,
     sourceMetadata: {
       scope: 'captured-source',
-      skills: sourceSkills,
+      skills: deduplicatedSourceSkills,
       usage,
     },
     coverage: [
       ...baseCoverage(events),
       ...coverage,
       {
-        dataClass: 'skills',
-        status:
-          input.source.runtime === 'claude-code' && sourceSkills.length > 0
-            ? 'available'
-            : 'not-recorded',
-        captured: sourceSkills.length,
+        dataClass: 'source-skill-names',
+        status: sourceSkillNamesRecorded ? 'available' : 'not-recorded',
+        captured: deduplicatedSourceSkills.filter(
+          (skill) => skill.evidence === 'available',
+        ).length,
       },
     ],
   };
 }
diff --git a/src/shared/transcript/activity/project.test.ts b/src/shared/transcript/activity/project.test.ts
index c634afe4..10216857 100644
--- a/src/shared/transcript/activity/project.test.ts
+++ b/src/shared/transcript/activity/project.test.ts
@@ -624,16 +624,17 @@ describe('activity projection budgets', () => {
           jsonPointer: `/attachment/names/${index}`,
         },
       })),
       usage: {
         scope: 'captured-source',
         availability: 'recorded',
         samples: Array.from({ length: 1_000 }, (_, index) => ({
           semantics: 'claude-message' as const,
+          ownership: 'owned' as const,
           messageId: `message-${index}`,
           tokens: { input_tokens: index, output_tokens: index + 1 },
           locator: {
             recordIndex: index + 1_000,
             physicalLine: index + 1_001,
             jsonPointer: '/message/usage',
           },
         })),
@@ -669,16 +670,94 @@ describe('activity projection budgets', () => {
     expect(
       (report.sourceMetadata.usage?.diagnostics.length ?? 0) +
         report.omitted.usageDiagnostics,
     ).toBe(40);
     expect(report.omitted.usageSamples).toBeGreaterThan(0);
     expect(report.renderedBytes).toBeLessThanOrEqual(report.limits.maxBytes);
   });
 
+  it('trims oversized optional source metadata before delivered event evidence', () => {
+    const events = [
+      event('call-one', 'call', 0, {
+        nativeCallId: 'native-call-one',
+        arguments: { task: 'delivered call one' },
+      }),
+      event('result-one', 'result', 1, {
+        nativeCallId: 'native-call-one',
+        relatedCallKey: 'call-one',
+        result: { value: 'delivered result one' },
+      }),
+      event('call-two', 'call', 2, {
+        nativeCallId: 'native-call-two',
+        arguments: { task: 'delivered call two' },
+      }),
+      event('result-two', 'result', 3, {
+        nativeCallId: 'native-call-two',
+        relatedCallKey: 'call-two',
+        result: { value: 'delivered result two' },
+      }),
+    ];
+    const extracted = activity(events);
+    extracted.sourceMetadata = {
+      scope: 'captured-source',
+      skills: Array.from({ length: 400 }, (_, index) => ({
+        scope: 'captured-source' as const,
+        evidence: 'available' as const,
+        name: `source-skill-${index}-${'x'.repeat(32)}`,
+        locator: {
+          recordIndex: index + 100,
+          physicalLine: index + 101,
+          jsonPointer: `/attachment/names/${index}`,
+        },
+      })),
+      usage: {
+        scope: 'captured-source',
+        availability: 'recorded',
+        samples: Array.from({ length: 400 }, (_, index) => ({
+          semantics: 'claude-message' as const,
+          ownership: 'owned' as const,
+          messageId: `message-${index}`,
+          tokens: { input_tokens: index, output_tokens: index + 1 },
+          locator: {
+            recordIndex: index + 500,
+            physicalLine: index + 501,
+            jsonPointer: '/message/usage',
+          },
+        })),
+        diagnostics: [],
+      },
+    };
+
+    const report = projectActivity(extracted, {
+      mode: 'watch',
+      renderFormat: 'compact-json',
+      deliveryRange: wholeRange(events),
+    });
+
+    expect(report.limits.maxBytes).toBe(32 * 1024);
+    expect(report.events.map(({ eventKey }) => eventKey)).toEqual([
+      'call-one',
+      'result-one',
+      'call-two',
+      'result-two',
+    ]);
+    expect(report.omitted.byteLimitGroups).toBe(0);
+    expect(report.omitted.sourceSkills).toBeGreaterThan(0);
+    expect(report.omitted.usageSamples).toBeGreaterThan(0);
+    expect(
+      report.sourceMetadata.skills.length + report.omitted.sourceSkills,
+    ).toBe(400);
+    expect(
+      (report.sourceMetadata.usage?.samples.length ?? 0) +
+        report.omitted.usageSamples,
+    ).toBe(400);
+    expect(report.renderedBytes).toBeLessThanOrEqual(32 * 1024);
+  });
+
   it('keeps the activity budget independent from conversation content', () => {
     const events = [
       event('call', 'call', 0, { arguments: { value: 'activity' } }),
     ];
     const options = {
       mode: 'watch' as const,
       renderFormat: 'compact-json' as const,
       deliveryRange: wholeRange(events),
diff --git a/src/shared/transcript/activity/project.ts b/src/shared/transcript/activity/project.ts
index 2c31324d..f59702fa 100644
--- a/src/shared/transcript/activity/project.ts
+++ b/src/shared/transcript/activity/project.ts
@@ -364,16 +364,73 @@ function retainMetadata(
       ),
       diagnostics: metadata.usage.diagnostics.filter((_, index) =>
         retainedUsageDiagnostics.has(index),
       ),
     },
   };
 }
 
+function retainOptionalSourceMetadata(
+  metadata: ReportMetadata,
+  retainedCount: number,
+): ReportMetadata {
+  const priority = [
+    ...metadata.sourceSkills.map(
+      (entry, index): MetadataCandidate => ({
+        kind: 'sourceSkills',
+        index,
+        locator: entry.locator,
+      }),
+    ),
+    ...metadata.usage.samples.map(
+      (entry, index): MetadataCandidate => ({
+        kind: 'usageSamples',
+        index,
+        locator: entry.locator,
+      }),
+    ),
+    ...metadata.usage.diagnostics.map(
+      (entry, index): MetadataCandidate => ({
+        kind: 'usageDiagnostics',
+        index,
+        locator: entry.locator,
+      }),
+    ),
+  ].toSorted(compareMetadataPriority);
+  const retainedSourceSkills = new Set<number>();
+  const retainedUsageSamples = new Set<number>();
+  const retainedUsageDiagnostics = new Set<number>();
+  for (const candidate of priority.slice(0, retainedCount)) {
+    const target =
+      candidate.kind === 'sourceSkills'
+        ? retainedSourceSkills
+        : candidate.kind === 'usageSamples'
+          ? retainedUsageSamples
+          : retainedUsageDiagnostics;
+    target.add(candidate.index);
+  }
+  return {
+    coverage: metadata.coverage,
+    diagnostics: metadata.diagnostics,
+    sourceSkills: metadata.sourceSkills.filter((_, index) =>
+      retainedSourceSkills.has(index),
+    ),
+    usage: {
+      ...metadata.usage,
+      samples: metadata.usage.samples.filter((_, index) =>
+        retainedUsageSamples.has(index),
+      ),
+      diagnostics: metadata.usage.diagnostics.filter((_, index) =>
+        retainedUsageDiagnostics.has(index),
+      ),
+    },
+  };
+}
+
 function projectEvent(
   event: CorrelatedActivityEvent,
   limits: ActivityProjectionLimits,
   suppressLinkedItemOutput: boolean,
 ): ProjectedActivityEvent {
   return {
     eventKey: event.eventKey,
     kind: event.kind,
@@ -621,37 +678,85 @@ export function projectActivityWithLimits(
     limits,
     groups,
     retained,
     metadata,
     initialReasons,
   );
   if (initial.renderedBytes <= limits.maxBytes) return initial;
 
+  const optionalMetadataCount =
+    metadata.sourceSkills.length +
+    metadata.usage.samples.length +
+    metadata.usage.diagnostics.length;
+  let optionalLow = 0;
+  let optionalHigh = optionalMetadataCount;
+  let best: ActivityReport | undefined;
+  while (optionalLow <= optionalHigh) {
+    const retainedCount = Math.floor((optionalLow + optionalHigh) / 2);
+    const retainedMetadata = retainOptionalSourceMetadata(
+      metadata,
+      retainedCount,
+    );
+    const candidate = buildReport(
+      activity,
+      options,
+      limits,
+      groups,
+      retained,
+      retainedMetadata,
+      {
+        ...initialReasons,
+        sourceSkills:
+          metadata.sourceSkills.length - retainedMetadata.sourceSkills.length,
+        usageSamples:
+          metadata.usage.samples.length - retainedMetadata.usage.samples.length,
+        usageDiagnostics:
+          metadata.usage.diagnostics.length -
+          retainedMetadata.usage.diagnostics.length,
+      },
+    );
+    if (candidate.renderedBytes <= limits.maxBytes) {
+      best = candidate;
+      optionalLow = retainedCount + 1;
+    } else {
+      optionalHigh = retainedCount - 1;
+    }
+  }
+  if (best) return best;
+
+  const boundedMetadata = retainOptionalSourceMetadata(metadata, 0);
+  const boundedReasons: OmissionReasons = {
+    ...initialReasons,
+    sourceSkills: metadata.sourceSkills.length,
+    usageSamples: metadata.usage.samples.length,
+    usageDiagnostics: metadata.usage.diagnostics.length,
+  };
+
   const removable = groups
     .filter((group) => retained.has(group.key))
     .toSorted(compareLowPriority);
   let low = 1;
   let high = removable.length;
-  let best: ActivityReport | undefined;
+  best = undefined;
   while (low <= high) {
     const removedCount = Math.floor((low + high) / 2);
     const candidateKeys = new Set(retained);
     for (const group of removable.slice(0, removedCount)) {
       candidateKeys.delete(group.key);
     }
     const candidate = buildReport(
       activity,
       options,
       limits,
       groups,
       candidateKeys,
-      metadata,
+      boundedMetadata,
       {
-        ...initialReasons,
+        ...boundedReasons,
         byteLimitGroups: removedCount,
       },
     );
     if (candidate.renderedBytes <= limits.maxBytes) {
       best = candidate;
       high = removedCount - 1;
     } else {
       low = removedCount + 1;
diff --git a/src/shared/transcript/activity/render.ts b/src/shared/transcript/activity/render.ts
index c2685270..aa052cb7 100644
--- a/src/shared/transcript/activity/render.ts
+++ b/src/shared/transcript/activity/render.ts
@@ -185,16 +185,17 @@ export function renderActivityMarkdown(report: ActivityReport): string {
     }
   }
   const usage = report.sourceMetadata.usage;
   if (usage && usage.samples.length > 0) {
     lines.push('', '### Captured-source token usage', '');
     for (const sample of usage.samples) {
       const identity = Object.fromEntries(
         Object.entries({
+          ownership: sample.ownership,
           model: sample.model,
           messageId: sample.messageId,
           turnId: sample.turnId,
           responseId: sample.responseId,
           segment: sample.segment,
           uncertainty: sample.uncertainty,
         }).filter(([, value]) => value !== undefined),
       );
diff --git a/src/shared/transcript/activity/types.ts b/src/shared/transcript/activity/types.ts
index 7a1273d0..35278006 100644
--- a/src/shared/transcript/activity/types.ts
+++ b/src/shared/transcript/activity/types.ts
@@ -111,16 +111,17 @@ export interface ActivitySourceSkill {
 export type ActivityUsageSemantics =
   | 'claude-message'
   | 'codex-cumulative'
   | 'codex-last-turn'
   | 'codex-response';
 
 export interface ActivityTokenUsageSample {
   semantics: ActivityUsageSemantics;
+  ownership: ActivityOwnership;
   locator: ActivityEventLocator;
   tokens: JsonObject;
   model?: string;
   messageId?: string;
   turnId?: string;
   responseId?: string;
   segment?: number;
   uncertainty?: 'missing-message-id';
@@ -207,17 +208,17 @@ export interface ActivityDiagnostic {
 
 export type ActivityDataClass =
   | 'calls'
   | 'results'
   | 'items'
   | 'metadata'
   | 'persisted-output'
   | 'child-trajectory'
-  | 'skills'
+  | 'source-skill-names'
   | 'record-activity';
 
 export interface ActivityCoverageEntry {
   dataClass: ActivityDataClass;
   status: ActivityCoverageStatus;
   captured: number;
   locator?: ActivityLocator;
 }
@@ -384,16 +385,17 @@ export interface ActivityReport {
   sourceMetadata: ActivitySourceMetadata;
 }
 
 export interface ExtractedRecordActivity {
   events: ExtractedActivityEvent[];
   coverage: ActivityCoverageEntry[];
   diagnostics: ActivityDiagnostic[];
   sourceSkills?: ActivitySourceSkill[];
+  sourceSkillNamesRecorded?: boolean;
 }
 
 export function isJsonObject(value: unknown): value is JsonObject {
   return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
 
 export function stringValue(value: unknown): string | undefined {
   return typeof value === 'string' ? value : undefined;
diff --git a/src/shared/transcript/activity/usage.test.ts b/src/shared/transcript/activity/usage.test.ts
index b638ddac..469908aa 100644
--- a/src/shared/transcript/activity/usage.test.ts
+++ b/src/shared/transcript/activity/usage.test.ts
@@ -151,49 +151,58 @@ describe('captured-source token usage', () => {
     });
     const response = (
       responseId: string,
       turnId: string,
       total: number,
     ): JsonObject => ({
       type: 'token_usage_record',
       payload: {
-        session_id: 'native-session',
+        thread_id: 'native-session',
+        session_id: 'root-session',
         response_id: responseId,
         turn_id: turnId,
         usage: { input_tokens: total - 1, total_tokens: total },
         turn_token_usage: { input_tokens: total - 2, total_tokens: total },
         thread_token_usage: { input_tokens: total - 3, total_tokens: total },
       },
     });
     const records = [
+      detailed(
+        {
+          type: 'session_meta',
+          payload: { id: 'native-session', session_id: 'root-session' },
+        },
+        0,
+      ),
       detailed(
         {
           type: 'turn_context',
           payload: { turn_id: 'turn-1', model: 'gpt-fixture' },
         },
-        0,
+        1,
       ),
-      detailed(tokenCount(100, 20), 1),
       detailed(tokenCount(100, 20), 2),
-      detailed(tokenCount(80, 10), 3),
-      detailed(response('response-1', 'turn-1', 12), 4),
+      detailed(tokenCount(100, 20), 3),
+      detailed(tokenCount(80, 10), 4),
       detailed(response('response-1', 'turn-1', 12), 5),
-      detailed(response('response-1', 'turn-1', 15), 6),
-      detailed(response('response-2', 'turn-unknown', 7), 7),
+      detailed(response('response-1', 'turn-1', 12), 6),
+      detailed(response('response-1', 'turn-1', 15), 7),
+      detailed(response('response-2', 'turn-unknown', 7), 8),
       detailed(
         {
           type: 'token_usage_record',
           payload: {
-            session_id: 'other-session',
+            thread_id: 'other-thread',
+            session_id: 'root-session',
             response_id: 'wrong-session',
             usage: { total_tokens: 999 },
           },
         },
-        8,
+        9,
       ),
     ];
 
     const extracted = extractActivity({
       source: source('codex'),
       read: { ...SNAPSHOT, records, diagnostics: [] },
     });
     const metadata = extracted.sourceMetadata?.usage;
@@ -204,16 +213,24 @@ describe('captured-source token usage', () => {
       'codex-cumulative',
       'codex-last-turn',
       'codex-response',
       'codex-response',
     ]);
     expect(metadata?.samples.slice(0, 4).map(({ segment }) => segment)).toEqual(
       [0, 0, 1, 1],
     );
+    expect(metadata?.samples.map(({ ownership }) => ownership)).toEqual([
+      'owned',
+      'owned',
+      'owned',
+      'owned',
+      'owned',
+      'owned',
+    ]);
     expect(metadata?.samples[4]).toMatchObject({
       responseId: 'response-1',
       turnId: 'turn-1',
       model: 'gpt-fixture',
       tokens: {
         usage: { input_tokens: 11, total_tokens: 12 },
         turn_token_usage: { input_tokens: 10, total_tokens: 12 },
         thread_token_usage: { input_tokens: 9, total_tokens: 12 },
@@ -223,16 +240,102 @@ describe('captured-source token usage', () => {
     expect(metadata?.diagnostics.map(({ code }) => code)).toEqual([
       'USAGE_COUNTER_RESET',
       'USAGE_CONFLICT',
       'USAGE_SESSION_MISMATCH',
     ]);
     expect(JSON.stringify(metadata)).not.toMatch(/price|cost|currency/iu);
   });
 
+  it('labels inherited, owned, and unknown Codex counters without crossing ownership boundaries', () => {
+    const tokenCount = (
+      total: number,
+      ordinal?: number,
+    ): DetailedTranscriptRecord =>
+      detailed(
+        {
+          ...(ordinal === undefined ? {} : { ordinal }),
+          type: 'event_msg',
+          payload: {
+            type: 'token_count',
+            info: {
+              total_token_usage: { total_tokens: total },
+              last_token_usage: { total_tokens: total / 10 },
+            },
+          },
+        },
+        total,
+      );
+    const records = [
+      detailed(
+        {
+          ordinal: 0,
+          type: 'session_meta',
+          payload: {
+            id: 'native-session',
+            session_id: 'root-session',
+            parent_thread_id: 'parent-thread',
+            subagent_history_start_ordinal: 5,
+          },
+        },
+        0,
+      ),
+      detailed(
+        {
+          ordinal: 4,
+          type: 'turn_context',
+          payload: { turn_id: 'cross-boundary-turn', model: 'parent-model' },
+        },
+        1,
+      ),
+      tokenCount(100, 2),
+      tokenCount(120, 3),
+      tokenCount(20, 6),
+      tokenCount(10, 7),
+      tokenCount(8),
+      detailed(
+        {
+          ordinal: 8,
+          type: 'token_usage_record',
+          payload: {
+            thread_id: 'native-session',
+            session_id: 'root-session',
+            response_id: 'owned-response',
+            turn_id: 'cross-boundary-turn',
+            usage: { total_tokens: 4 },
+          },
+        },
+        8,
+      ),
+    ];
+
+    const metadata = extractActivity({
+      source: source('codex'),
+      read: { ...SNAPSHOT, records, diagnostics: [] },
+    }).sourceMetadata?.usage;
+
+    expect(metadata?.samples.map(({ ownership }) => ownership)).toEqual([
+      'inherited',
+      'inherited',
+      'inherited',
+      'inherited',
+      'owned',
+      'owned',
+      'owned',
+      'owned',
+      'unknown',
+      'unknown',
+      'owned',
+    ]);
+    expect(metadata?.diagnostics.map(({ code }) => code)).toEqual([
+      'USAGE_COUNTER_RESET',
+    ]);
+    expect(metadata?.samples.at(-1)).not.toHaveProperty('model');
+  });
+
   it('reports absence as not-recorded instead of zero', () => {
     const extracted = extractActivity({
       source: source('codex'),
       read: { ...SNAPSHOT, records: [], diagnostics: [] },
     });
     expect(extracted.sourceMetadata?.usage).toEqual({
       scope: 'captured-source',
       availability: 'not-recorded',
diff --git a/src/shared/transcript/activity/usage.ts b/src/shared/transcript/activity/usage.ts
index f27e990a..c5ab2529 100644
--- a/src/shared/transcript/activity/usage.ts
+++ b/src/shared/transcript/activity/usage.ts
@@ -1,14 +1,16 @@
 import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
+import { activityOwnershipContext, ownershipForLocator } from './correlate.js';
 import type {
   ActivitySource,
   ActivityTokenUsageSample,
   ActivityUsageDiagnostic,
   ActivityUsageMetadata,
+  ExtractedActivityEvent,
 } from './types.js';
 import {
   isJsonObject,
   numberValue,
   recordLocator,
   stringValue,
 } from './types.js';
 
@@ -80,16 +82,17 @@ function claudeUsage(
     ) {
       diagnostics.push({ code: 'USAGE_SESSION_MISMATCH', locator });
       continue;
     }
     const messageId = stringValue(message.id)?.trim() || undefined;
     const model = stringValue(message.model)?.trim() || undefined;
     const sample: ActivityTokenUsageSample = {
       semantics: 'claude-message',
+      ownership: 'owned',
       locator,
       tokens,
       ...(model === undefined ? {} : { model }),
       ...(messageId === undefined
         ? { uncertainty: 'missing-message-id' as const }
         : { messageId }),
     };
     if (messageId === undefined) {
@@ -116,83 +119,102 @@ function claudeUsage(
     samples,
     diagnostics,
   };
 }
 
 function codexUsage(
   source: ActivitySource,
   records: readonly DetailedTranscriptRecord[],
+  events: readonly ExtractedActivityEvent[],
 ): ActivityUsageMetadata {
   const samples: ActivityTokenUsageSample[] = [];
   const diagnostics: ActivityUsageDiagnostic[] = [];
+  const ownershipContext = activityOwnershipContext(source, events);
   const turnModels = new Map<string, string>();
-  for (const { record } of records) {
+  for (const detailed of records) {
+    const { record } = detailed;
     if (record.type !== 'turn_context' || !isJsonObject(record.payload))
       continue;
     const turnId = stringValue(record.payload.turn_id);
     const model = stringValue(record.payload.model);
-    if (turnId && model) turnModels.set(turnId, model);
+    if (turnId && model) {
+      const ownership = ownershipForLocator(
+        recordLocator(detailed, '/payload'),
+        ownershipContext,
+      );
+      turnModels.set(`${ownership}:${turnId}`, model);
+    }
   }
 
-  let previousSnapshot: string | undefined;
-  let previousTotal: number | undefined;
-  let segment = 0;
+  const counterStates = new Map<
+    ActivityTokenUsageSample['ownership'],
+    { previousSnapshot?: string; previousTotal?: number; segment: number }
+  >();
   const responses = new Map<string, string>();
 
   for (const detailed of records) {
     const { record } = detailed;
     const payload = isJsonObject(record.payload) ? record.payload : undefined;
     if (record.type === 'event_msg' && payload?.type === 'token_count') {
       const info = isJsonObject(payload.info) ? payload.info : undefined;
       if (!info) continue;
       const total = tokenFields(info.total_token_usage);
       const last = tokenFields(info.last_token_usage);
       if (!total && !last) continue;
+      const totalLocator = recordLocator(
+        detailed,
+        '/payload/info/total_token_usage',
+      );
+      const ownership = ownershipForLocator(totalLocator, ownershipContext);
+      const state = counterStates.get(ownership) ?? { segment: 0 };
       const snapshot = signature({ total, last });
-      if (snapshot === previousSnapshot) continue;
-      previousSnapshot = snapshot;
+      if (snapshot === state.previousSnapshot) continue;
+      state.previousSnapshot = snapshot;
       const totalTokens = total ? numberValue(total.total_tokens) : undefined;
       if (
         totalTokens !== undefined &&
-        previousTotal !== undefined &&
-        totalTokens < previousTotal
+        state.previousTotal !== undefined &&
+        totalTokens < state.previousTotal
       ) {
-        segment += 1;
+        state.segment += 1;
         diagnostics.push({
           code: 'USAGE_COUNTER_RESET',
-          locator: recordLocator(detailed, '/payload/info/total_token_usage'),
+          locator: totalLocator,
         });
       }
-      if (totalTokens !== undefined) previousTotal = totalTokens;
+      if (totalTokens !== undefined) state.previousTotal = totalTokens;
+      counterStates.set(ownership, state);
       if (total) {
         samples.push({
           semantics: 'codex-cumulative',
-          locator: recordLocator(detailed, '/payload/info/total_token_usage'),
+          ownership,
+          locator: totalLocator,
           tokens: total,
-          segment,
+          segment: state.segment,
         });
       }
       if (last) {
         samples.push({
           semantics: 'codex-last-turn',
+          ownership,
           locator: recordLocator(detailed, '/payload/info/last_token_usage'),
           tokens: last,
-          segment,
+          segment: state.segment,
         });
       }
       continue;
     }
 
     if (record.type !== 'token_usage_record' || !payload) continue;
-    const recordedSessionId = stringValue(payload.session_id);
+    const recordedThreadId = stringValue(payload.thread_id);
     const locator = recordLocator(detailed, '/payload');
     if (
-      recordedSessionId !== undefined &&
-      recordedSessionId !== source.nativeSessionId
+      recordedThreadId !== undefined &&
+      recordedThreadId !== source.nativeSessionId
     ) {
       diagnostics.push({ code: 'USAGE_SESSION_MISMATCH', locator });
       continue;
     }
     const usage = tokenFields(payload.usage);
     const turnUsage = tokenFields(payload.turn_token_usage);
     const threadUsage = tokenFields(payload.thread_token_usage);
     if (!usage && !turnUsage && !threadUsage) continue;
@@ -208,19 +230,21 @@ function codexUsage(
       const prior = responses.get(responseId);
       if (prior === sampleSignature) continue;
       if (prior !== undefined) {
         diagnostics.push({ code: 'USAGE_CONFLICT', locator });
         continue;
       }
       responses.set(responseId, sampleSignature);
     }
-    const model = turnId ? turnModels.get(turnId) : undefined;
+    const ownership = ownershipForLocator(locator, ownershipContext);
+    const model = turnId ? turnModels.get(`${ownership}:${turnId}`) : undefined;
     samples.push({
       semantics: 'codex-response',
+      ownership,
       locator,
       tokens,
       ...(model === undefined ? {} : { model }),
       ...(turnId === undefined ? {} : { turnId }),
       ...(responseId === undefined ? {} : { responseId }),
     });
   }
 
@@ -230,20 +254,21 @@ function codexUsage(
     samples,
     diagnostics,
   };
 }
 
 export function extractUsageMetadata(
   source: ActivitySource,
   records: readonly DetailedTranscriptRecord[],
+  events: readonly ExtractedActivityEvent[] = [],
 ): ActivityUsageMetadata {
   return source.runtime === 'claude-code'
     ? claudeUsage(source, records)
-    : codexUsage(source, records);
+    : codexUsage(source, records, events);
 }
 
 export function notRecordedUsage(): ActivityUsageMetadata {
   return {
     scope: 'captured-source',
     availability: 'not-recorded',
     samples: [],
     diagnostics: [],
diff --git a/src/skills/session-export-transcript/SKILL.md b/src/skills/session-export-transcript/SKILL.md
index f340ad59..9454a495 100644
--- a/src/skills/session-export-transcript/SKILL.md
+++ b/src/skills/session-export-transcript/SKILL.md
@@ -4,17 +4,17 @@ description: Use when the user asks to export, save, or download the current cod
 license: MIT
 compatibility: Agent Skills baseline; requires Node.js 22+. No third-party runtime dependencies.
 argument-hint: '[output-path] [--runtime <claude-code|codex|cursor|auto>] [--match <marker>] [--session <id>] [--all] [--include-activity] [--out <path>]'
 disable-model-invocation: false
 user-invocable: true
 allowed-tools: Bash, Read
 metadata:
   author: thomas.stang
-  version: '2.0.27'
+  version: '2.0.28'
 ---
 
 # {{distribution.name}}
 
 Exports the **current** conversation (yours — Claude Code, Codex, or Cursor) to a
 sanitized Markdown transcript, named after the current git branch, written by
 default to `~/Downloads`. Tool calls, tool results, system/developer instructions,
 environment/AGENTS.md/skill payloads, subagent notifications, automatic-control
diff --git a/src/skills/session-fork-to-destination/SKILL.md b/src/skills/session-fork-to-destination/SKILL.md
index 14d6ab92..b52c85a5 100644
--- a/src/skills/session-fork-to-destination/SKILL.md
+++ b/src/skills/session-fork-to-destination/SKILL.md
@@ -4,17 +4,17 @@ description: Use when the user wants to find a Codex or Claude Code conversation
 license: MIT
 compatibility: Alpha guidance workflow; provider coverage and end-to-end verification are incomplete. Requires Node.js 22+ and local provider transcript stores for read-only discovery. The user runs any provider command manually.
 argument-hint: '[source-worktree] [destination-worktree]'
 disable-model-invocation: false
 user-invocable: true
 allowed-tools: Read, Bash(node <skill-dir>/scripts/session-fork-to-destination.mjs:*)
 metadata:
   author: thomas.stang
-  version: '0.2.41'
+  version: '0.2.42'
 ---
 
 # {{distribution.name}}
 
 > **Alpha.** This skill discovers and previews local sessions
 > read-only, then prepares instructions. It does not run a provider, authenticate,
 > create a fork, write a receipt, retry, reconcile a child ID, or control an IDE tab.
 
diff --git a/src/skills/session-observer-collab/SKILL.md b/src/skills/session-observer-collab/SKILL.md
index 5bda1478..6f91140b 100644
--- a/src/skills/session-observer-collab/SKILL.md
+++ b/src/skills/session-observer-collab/SKILL.md
@@ -4,17 +4,17 @@ description: Use when two coding-agent sessions should observe each other and co
 license: MIT
 compatibility: Agent Skills baseline; requires Node.js 22+. No third-party runtime dependencies. Requires the declared observer skill for transcript operations.
 argument-hint: '[start|review|watch|close] [--runtime <claude-code|codex|cursor|other>]'
 disable-model-invocation: false
 user-invocable: true
 allowed-tools: Bash(node:*) Read AskUserQuestion
 metadata:
   author: thomas.stang
-  version: '1.0.64'
+  version: '1.0.65'
 ---
 
 # {{distribution.name}}
 
 Coordinate a user and two agent sessions through the canonical
 `{{skill:session-observer}}` skill. This skill defines collaboration protocol and wake
 boundaries; it does not reimplement transcript discovery, normalization,
 rendering, or offset storage.
diff --git a/src/skills/session-observer/SKILL.md b/src/skills/session-observer/SKILL.md
index 3cfb1359..73fc5fb1 100644
--- a/src/skills/session-observer/SKILL.md
+++ b/src/skills/session-observer/SKILL.md
@@ -4,17 +4,17 @@ description: Use when checking what another coding agent (Claude Code, Codex, or
 license: MIT
 compatibility: Agent Skills baseline; requires Node.js 22+. No third-party runtime dependencies.
 argument-hint: '[review|catch-up|catch-up-then-watch|locate|whoami|state|watch|watch-ctl|--watch] [--runtime <claude-code|codex|cursor|auto|both>] [--debug]'
 disable-model-invocation: false
 user-invocable: true
 allowed-tools: Bash, Read, AskUserQuestion
 metadata:
   author: thomas.stang
-  version: '1.0.76'
+  version: '1.0.77'
 ---
 
 # {{distribution.name}}
 
 Lets you (Claude Code, Codex, or Cursor) inspect another runtime's transcript for the current project, render a tool-free digest, and track runtime-specific read positions so follow-up checks surface only new content.
 
 ## Local runtime preflight
 
diff --git a/src/skills/session-observer/src/lib/watch.ts b/src/skills/session-observer/src/lib/watch.ts
index 996d9fcb..b8bc1d5f 100644
--- a/src/skills/session-observer/src/lib/watch.ts
+++ b/src/skills/session-observer/src/lib/watch.ts
@@ -273,17 +273,17 @@ function activitySourceSignature(target: WatchTarget): string {
   return `${target.signature.mtimeMs}:${target.signature.size}`;
 }
 
 function activityCoverageSignal(digest: SessionDigest): boolean {
   return Boolean(
     digest.activity?.diagnostics.length ||
     digest.activity?.coverage.some(
       (entry) =>
-        entry.dataClass !== 'skills' &&
+        entry.dataClass !== 'source-skill-names' &&
         (entry.locator !== undefined || entry.status !== 'available'),
     ),
   );
 }
 
 function activityAccountingSignal(digest: SessionDigest): boolean {
   const activity = digest.activity;
   if (!activity) return false;

```
