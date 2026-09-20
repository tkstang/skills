# Immutable phase review packet

Captured: 2026-09-20T22:46:03.949584+00:00
Repository: /Users/tstang/orca/workspaces/skills/session-fidelity
Base: 6d863965848d699afa09cd075d2295e57772be34
Reviewed HEAD: 8094b2dff14d9f2bea6f0b03f2ec82857e7d1898
Checkout status: clean

## Request

Review p02 native skill attribution and usage metadata against tasks p02-t01 and p02-t02 in the canonical session-evidence-followups plan. Scope: authored delta since 6d863965848d699afa09cd075d2295e57772be34 plus generated parity. Read surrounding immutable code as needed. No edits or provider calls. Verify correctness, native-schema grounding, source versus delivered scope, compact budgets, identity consistency, and no guessed accounting.
Skill evidence: Claude top-level attributionSkill and Skill tool invocation, names-only skill_listing names versus invoked_skills skills[].name with correct meaning, locators and no instruction bodies. Cursor observed ReadFile/Read input.path only. Codex historical native experimental read_file arguments.file_path only, verified from official pre-removal source c6ffe9abab04bd3349ecc49fffc0fbf9551826e6 and removal 14c35a16a8a41cc16c5e36c2c4287b7b2db6e975 (2026-03-25); current sampled shell reads are not inferred. Unknown tools/keys/prose/shell remain unclassified. File-read evidence is inferred load, not proven invocation or success. No invented skill versions.
Usage: exact-session Claude message.id dedup, equal collapse, conflicts diagnostics without summing competing values, missing IDs uncertain. Preserve Codex cumulative total, per-turn last, response usage as separate semantics; repeats and decreases/reset segments; model only native or proven turn join, unknown preserved; no cumulative+per-turn sum. Cursor not-recorded rather than zero. Optional metadata budget is accounted and omissions/coverage honest. Existing default consumers remain compatible with additions.
Review tests for real regressions and doc/implementation consistency. Identify actionable issues with concrete triggers, not speculative additions. Consult worker evidence recorded in implementation.md but do not treat test success as semantic proof.
Response contract: findings use external-document anchor with exact packet SHA256, naming affected repository path/lines in claim/evidence. No Critical/High means verdict pass (Medium/Low findings allowed); changes_requested requires Critical/High. Be honest about unrun checks.


## Scope adaptation

The base-branch selector captures entire before/after files including generated bundles and is capped at 2 MiB. This packet preserves the exact authored before/after Git diff (including deletions), all changed-file hashes, and immutable base/head references instead. Historical review artifacts and previously captured review packets are represented by hashes rather than recursively embedded; they remain available through the immutable revisions for context. Generated content is checked by build:check and version validation, with parity inspected where needed. The reviewer may read repository context and git-show either immutable revision but must not mutate any file or invoke providers. The whole checkout stays stable during review. Findings should use an anchor into THIS external packet with the exact packet SHA256 supplied by the wrapper; name the affected repository path/line in the claim/evidence. Never invent captured repository locations for files that are only context. This is a code-diff review carried as an external document, not an architecture-only plan review.

## Changed file manifest

```json
[
  {
    "path": ".oat/projects/shared/session-evidence-followups/evidence/p02-codex-read-schema.json",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 5266,
      "sha256": "bc60ac7dd1d9d22d17757e5603f0e2cef76dfe2a098d984d3df02d63504d5bd8"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/evidence/p02-cursor-carrier-scan.txt",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 646,
      "sha256": "d15ca623c59aa0c525aaedb7a3f4669a787b67ae9936f71313afca1114b07b87"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/implementation.md",
    "generated": false,
    "base": {
      "bytes": 14212,
      "sha256": "67ddd02e9f042431c2e7077c094b76b2aa4d23325af0084da038fe6530658fec"
    },
    "head": {
      "bytes": 19074,
      "sha256": "6c7330e591bae3645d275fe5ede19336dbd18ad82fd2273142d60c7de5045d63"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/plan.md",
    "generated": false,
    "base": {
      "bytes": 29114,
      "sha256": "b651defdb300c8485de07d377456d077c88d090293c6e9d6e3ba20288b4993db"
    },
    "head": {
      "bytes": 29162,
      "sha256": "fa1defccf6580385a0a06bce8c6a30387a92cc5d1bcbc305fbe88b2676fe4d22"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/project-log.md",
    "generated": false,
    "base": {
      "bytes": 2529,
      "sha256": "900424de24c4a2952afdbd1c90a1f561b947fea4d0cbe3431f940b081ccdc991"
    },
    "head": {
      "bytes": 2745,
      "sha256": "4096e668d6e37e9aea8d6228320e3569cffd2f1d5fd6cc9feda90e350311b8a5"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/state.md",
    "generated": false,
    "base": {
      "bytes": 6793,
      "sha256": "824ed9be5945b7316f24025ad212c3a585c7bbe63d981b4867b8f01713a0dfae"
    },
    "head": {
      "bytes": 6838,
      "sha256": "83cdf41eb426203db800f27b90eb7e955ee6554b781c68fdb3ab1ade1d088543"
    }
  },
  {
    "path": "CHANGELOG.md",
    "generated": false,
    "base": {
      "bytes": 40739,
      "sha256": "2c20f3c6d3c1a41953a0cabc931b3ab963220bc1aa490335ecdc52e3ac4416f5"
    },
    "head": {
      "bytes": 41770,
      "sha256": "59503b1c7ed709d7f1eba2fee9f94f82804fd006226e9adc65b70386d050bd4d"
    }
  },
  {
    "path": "documentation/docs/engineering/architecture/session-schemas/claude-code.md",
    "generated": false,
    "base": {
      "bytes": 51105,
      "sha256": "86028630e69aa2b1c7face1b258714357564cf09633411cb809fec5540e55b25"
    },
    "head": {
      "bytes": 52084,
      "sha256": "613fc7bd8554583a6e50f4130436b4b5791e48ea05e761566cc0a9b32978e25e"
    }
  },
  {
    "path": "documentation/docs/engineering/architecture/session-schemas/codex.md",
    "generated": false,
    "base": {
      "bytes": 27573,
      "sha256": "36743e5668c054cee0c9fcdab78f1fe671f2f34c3824feb3d9a80f7ead490617"
    },
    "head": {
      "bytes": 28672,
      "sha256": "a0fc47288db37d26a75de46726b9d09633efe104a706683cfc485e6cc3663132"
    }
  },
  {
    "path": "documentation/docs/engineering/architecture/session-schemas/cursor.md",
    "generated": false,
    "base": {
      "bytes": 16652,
      "sha256": "6ab4d5e09d34f27c7804efe2adaa1701d57ac93aeb6df85fc263bbc62dacf746"
    },
    "head": {
      "bytes": 16983,
      "sha256": "35368c8773f03d0bedee3ce9bb724a12dc04a13bee6f651b0d8a7ff947d6b974"
    }
  },
  {
    "path": "documentation/docs/engineering/architecture/session-schemas/index.md",
    "generated": false,
    "base": {
      "bytes": 9707,
      "sha256": "10683b8566d36d09eed937d9ca5815506cdd434180f8bbaed13e7bc2a5e580f4"
    },
    "head": {
      "bytes": 10847,
      "sha256": "c6b2c9fec0484303fe13f892f80205f0819892219026891176e7bcede3a2ce1f"
    }
  },
  {
    "path": "documentation/docs/user-guide/skills/session-export-transcript.md",
    "generated": false,
    "base": {
      "bytes": 6806,
      "sha256": "2ee851875876009f1976276b9685269a6f29ad263f237293802354c86d224cba"
    },
    "head": {
      "bytes": 8321,
      "sha256": "d6a34af0bf12f5eae1dc13a3800028b112dc59b44da06d4065b55fb3d221c21f"
    }
  },
  {
    "path": "documentation/docs/user-guide/skills/session-observer.md",
    "generated": false,
    "base": {
      "bytes": 21570,
      "sha256": "284e8a16da2b0ebc393d36f214ff79890b2da879b43cb67208c8a45f89ea56d1"
    },
    "head": {
      "bytes": 23324,
      "sha256": "38ead89ec7a3e0447def177cc24e72d6c78225a157290dd5d4e62256ff1debed"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 21438,
      "sha256": "2dbfa07d209db11f0455888268315b7c28da10e9b712789942f54aa9f917f68c"
    },
    "head": {
      "bytes": 21438,
      "sha256": "a8e049f8ecb81770f6c8527aa366383e155a0486a84b04fcf8942ab2dd6c39ce"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/claude-monitor.mjs",
    "generated": true,
    "base": {
      "bytes": 303772,
      "sha256": "22ee080045cd9f8711e6066bbdfdda3df5404762fa96c705cc50ce13d121cbd6"
    },
    "head": {
      "bytes": 319818,
      "sha256": "26af48d691ebac8c9ed90c6117afea352f5ed56aa815dcc1ea9ba7b3ae707c89"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/hooks/codex-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 281987,
      "sha256": "966d6dd38e1d0a9023d3b171959f935079aac68505a081366f941260543f128f"
    },
    "head": {
      "bytes": 298033,
      "sha256": "f373b2a316ec559b3d313e486d0fd9ca8f93bc9f59fa44e4c3d9ab30b3213aad"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/hooks/cursor-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 224749,
      "sha256": "37e866df35913a4f4f690877ce489b7392a1532a976b4d2fce0c44d57c725e85"
    },
    "head": {
      "bytes": 240782,
      "sha256": "3f130e722038e3a5fada5cfb3c43d9e22d440c34b6ed24f2c1eb68262b814571"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/lib/selected-prefix.mjs",
    "generated": true,
    "base": {
      "bytes": 165931,
      "sha256": "062e716778d9289538d718df0e93b789ac2f56957caa2c762680c8615d4c98fe"
    },
    "head": {
      "bytes": 181991,
      "sha256": "9ee92acdc20f890e7cf61ea9e7999b58860231a538d538f59cc429fad21636bf"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 48764,
      "sha256": "b7dc436e907b7e88f18eb565300c7dda09f99d5464203aec9f8f40e9a47f2e1d"
    },
    "head": {
      "bytes": 48764,
      "sha256": "d2ce35ef8634f71c59ed53f81c948c36d37bb3bd955c523f8845a751566b6858"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/digest.mjs",
    "generated": true,
    "base": {
      "bytes": 153155,
      "sha256": "b0bf341b044f3e3f7cd77c22bfdb5518c1f1e122f51875b70ddced5f6360a563"
    },
    "head": {
      "bytes": 169188,
      "sha256": "f3b451d8cedcabe40a29b827bf8b06e6ed5cd1ebf2d5b435f76c76eb2afc3171"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/observe.mjs",
    "generated": true,
    "base": {
      "bytes": 323388,
      "sha256": "887638f20352a9c2ea39326760ffd24604d0c404f2d7b3a5020a9b97a3fe08eb"
    },
    "head": {
      "bytes": 339460,
      "sha256": "3a59cdf88aafec72ffe736119b7a54ca782a478640680faaeb8955eb730c3432"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/watch.mjs",
    "generated": true,
    "base": {
      "bytes": 397948,
      "sha256": "a827fdccc8cc5cb5fb096a34c03cac533225f927b716b21d6241166693b49027"
    },
    "head": {
      "bytes": 414895,
      "sha256": "74b10322eb8832927b3a2d70cec9a29c0e51838deb1d326067b21ee85007120a"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/session-observer.mjs",
    "generated": true,
    "base": {
      "bytes": 467435,
      "sha256": "ec96baa8e72d6fff429c043593c63573588a06396bc91966627e2b0dedee0a0c"
    },
    "head": {
      "bytes": 484397,
      "sha256": "250cbce91c1f411dd6fd4899b32ddc367f3a609dc4635d3ff4c6ada30d5d6227"
    }
  },
  {
    "path": "plugins/session/skills/export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 11592,
      "sha256": "9a63eed320a58b346056abd4fe86cd87206f519a2243e447029df5186155a05e"
    },
    "head": {
      "bytes": 11592,
      "sha256": "d6fee8c02ba2d54f13fda4c707412880bbe660d80355019e02fb268721d9b2e2"
    }
  },
  {
    "path": "plugins/session/skills/export-transcript/scripts/session-export-transcript.mjs",
    "generated": true,
    "base": {
      "bytes": 141827,
      "sha256": "adc72eb850df7a252c7c431a9a25bfb26d5c2f4d32d830a361ed4a31e7b02d3a"
    },
    "head": {
      "bytes": 157860,
      "sha256": "1c276a43012ee22f0a04a3f9d86c09d3b19271df89a1440d5c0a3e6a4f03bca6"
    }
  },
  {
    "path": "plugins/session/skills/fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4412,
      "sha256": "ee66456dc19659e5e5df240c1204419e4b0d4556729398b485ee68120564e32a"
    },
    "head": {
      "bytes": 4412,
      "sha256": "683b8e16f2a8ffe0b34eaf1634dd4ca582e967e8eb016baa01a9637acfc650a8"
    }
  },
  {
    "path": "skills/session-export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 11608,
      "sha256": "67b8d0306df5c549566099a8acba65b8f8ed658b2127ecc245f845334e697c7a"
    },
    "head": {
      "bytes": 11608,
      "sha256": "e938b363a102b3111b8b33e0f35faa87b08aca670eafcab07251836847c61b69"
    }
  },
  {
    "path": "skills/session-export-transcript/scripts/session-export-transcript.mjs",
    "generated": true,
    "base": {
      "bytes": 141827,
      "sha256": "adc72eb850df7a252c7c431a9a25bfb26d5c2f4d32d830a361ed4a31e7b02d3a"
    },
    "head": {
      "bytes": 157860,
      "sha256": "1c276a43012ee22f0a04a3f9d86c09d3b19271df89a1440d5c0a3e6a4f03bca6"
    }
  },
  {
    "path": "skills/session-fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4428,
      "sha256": "e95d7e6b8389ac0f03ff0d1b043c62bb7128d490c9dc8ebd39742d4bcea45ab6"
    },
    "head": {
      "bytes": 4428,
      "sha256": "e55d9055de1421704efe50fc0e7bb185c74af6a9de17d79783a3b9aae29c3402"
    }
  },
  {
    "path": "skills/session-observer-collab/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 21502,
      "sha256": "3b395cea9adff5ee220b6c31277d63cc50dadcf62232daf5abdf528a00b96b60"
    },
    "head": {
      "bytes": 21502,
      "sha256": "c42987d86df726b01ae2a3b952949cc06f964cc21ae3f626107faeaf0316706d"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/claude-monitor.mjs",
    "generated": true,
    "base": {
      "bytes": 303772,
      "sha256": "22ee080045cd9f8711e6066bbdfdda3df5404762fa96c705cc50ce13d121cbd6"
    },
    "head": {
      "bytes": 319818,
      "sha256": "26af48d691ebac8c9ed90c6117afea352f5ed56aa815dcc1ea9ba7b3ae707c89"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/hooks/codex-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 281987,
      "sha256": "966d6dd38e1d0a9023d3b171959f935079aac68505a081366f941260543f128f"
    },
    "head": {
      "bytes": 298033,
      "sha256": "f373b2a316ec559b3d313e486d0fd9ca8f93bc9f59fa44e4c3d9ab30b3213aad"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/hooks/cursor-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 224749,
      "sha256": "37e866df35913a4f4f690877ce489b7392a1532a976b4d2fce0c44d57c725e85"
    },
    "head": {
      "bytes": 240782,
      "sha256": "3f130e722038e3a5fada5cfb3c43d9e22d440c34b6ed24f2c1eb68262b814571"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/lib/selected-prefix.mjs",
    "generated": true,
    "base": {
      "bytes": 165931,
      "sha256": "062e716778d9289538d718df0e93b789ac2f56957caa2c762680c8615d4c98fe"
    },
    "head": {
      "bytes": 181991,
      "sha256": "9ee92acdc20f890e7cf61ea9e7999b58860231a538d538f59cc429fad21636bf"
    }
  },
  {
    "path": "skills/session-observer/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 48780,
      "sha256": "1efd373b27d2c5595d73efc8925a400c8446363f0e44d2571b665bf64ecb44da"
    },
    "head": {
      "bytes": 48780,
      "sha256": "90adef5360c588cfafc12216430e5f4b8ad7bfc59862da7bf1fdb74001d144e7"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/digest.mjs",
    "generated": true,
    "base": {
      "bytes": 153155,
      "sha256": "b0bf341b044f3e3f7cd77c22bfdb5518c1f1e122f51875b70ddced5f6360a563"
    },
    "head": {
      "bytes": 169188,
      "sha256": "f3b451d8cedcabe40a29b827bf8b06e6ed5cd1ebf2d5b435f76c76eb2afc3171"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/observe.mjs",
    "generated": true,
    "base": {
      "bytes": 323388,
      "sha256": "887638f20352a9c2ea39326760ffd24604d0c404f2d7b3a5020a9b97a3fe08eb"
    },
    "head": {
      "bytes": 339460,
      "sha256": "3a59cdf88aafec72ffe736119b7a54ca782a478640680faaeb8955eb730c3432"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/watch.mjs",
    "generated": true,
    "base": {
      "bytes": 397948,
      "sha256": "a827fdccc8cc5cb5fb096a34c03cac533225f927b716b21d6241166693b49027"
    },
    "head": {
      "bytes": 414895,
      "sha256": "74b10322eb8832927b3a2d70cec9a29c0e51838deb1d326067b21ee85007120a"
    }
  },
  {
    "path": "skills/session-observer/scripts/session-observer.mjs",
    "generated": true,
    "base": {
      "bytes": 467435,
      "sha256": "ec96baa8e72d6fff429c043593c63573588a06396bc91966627e2b0dedee0a0c"
    },
    "head": {
      "bytes": 484397,
      "sha256": "250cbce91c1f411dd6fd4899b32ddc367f3a609dc4635d3ff4c6ada30d5d6227"
    }
  },
  {
    "path": "src/shared/transcript/activity/claude-code.ts",
    "generated": false,
    "base": {
      "bytes": 9229,
      "sha256": "88946d3c4128101590ee0fc8e402c594fdfbb4a434e70e9d19fb23144a808532"
    },
    "head": {
      "bytes": 12425,
      "sha256": "42b86e7eda7844a2edb5b37f851fca7fea45d4e5e02a85a59daf749ca49034cb"
    }
  },
  {
    "path": "src/shared/transcript/activity/codex.ts",
    "generated": false,
    "base": {
      "bytes": 14944,
      "sha256": "503a4646391fa3343f1ca18f89bdee1090b9694014bfc9653443b6c50c004304"
    },
    "head": {
      "bytes": 15265,
      "sha256": "985f17595fb14de64ab8229ce2a582f4451ff5410ff7357a4a1fe90105ffae69"
    }
  },
  {
    "path": "src/shared/transcript/activity/cursor.test.ts",
    "generated": false,
    "base": {
      "bytes": 11188,
      "sha256": "13eb8d2877456c9bbfcd7807d7b69a9f8607118f6640ea2f18a10e4796b000eb"
    },
    "head": {
      "bytes": 12623,
      "sha256": "680890b96db6224c912c0ad668c76862b22671874ae3804ee6cbac54707b4e34"
    }
  },
  {
    "path": "src/shared/transcript/activity/cursor.ts",
    "generated": false,
    "base": {
      "bytes": 6619,
      "sha256": "3fc9dc0f36c0b254995987cd20d0deb071d9bd10ae40b7e7dd0c372104c55bfe"
    },
    "head": {
      "bytes": 7186,
      "sha256": "bb8b90054504911980e1233a731024f2f860ee7fe5fa30c4bbb1415dbf61b61d"
    }
  },
  {
    "path": "src/shared/transcript/activity/extract.test.ts",
    "generated": false,
    "base": {
      "bytes": 22806,
      "sha256": "554f9ae39cd0d277feef5c567e99e3f5394405066ed85783ef03c1d16e3ebe37"
    },
    "head": {
      "bytes": 28504,
      "sha256": "413fd8b5fbdd4dddec275fd139c70d9f07bc855247f01811d01e97ea3afb5f6a"
    }
  },
  {
    "path": "src/shared/transcript/activity/extract.ts",
    "generated": false,
    "base": {
      "bytes": 3898,
      "sha256": "b08d874a029d10586804aac4640cc123a7d16e3f20f55ec14cf1134ab8fa79c6"
    },
    "head": {
      "bytes": 4611,
      "sha256": "bc97cd345b9cd77f5e632f7a0431c998945923b60c6195921a23b36ffe852480"
    }
  },
  {
    "path": "src/shared/transcript/activity/project.test.ts",
    "generated": false,
    "base": {
      "bytes": 24579,
      "sha256": "69b0a5baa0e211b044c4ad8dde3000b4eab6faf83c2d33de46674d6844617706"
    },
    "head": {
      "bytes": 26840,
      "sha256": "139171b33a83da95331971a68f616ebe5818cf5528e82e6e80e873f6a7e74211"
    }
  },
  {
    "path": "src/shared/transcript/activity/project.ts",
    "generated": false,
    "base": {
      "bytes": 18476,
      "sha256": "1b5b38c71c53b706f27922200073acf9cb47017b187929dd002073f4b6b40733"
    },
    "head": {
      "bytes": 21186,
      "sha256": "ea924803730f0f568a9caa4fbf4ae5041b065c9a855ed742e79da5d5fe43d4ef"
    }
  },
  {
    "path": "src/shared/transcript/activity/render.ts",
    "generated": false,
    "base": {
      "bytes": 6957,
      "sha256": "bd335eb9bea83c844f50aee29fa611fcc0fa9e9e0090deaaf7d44605a2c7aa27"
    },
    "head": {
      "bytes": 8880,
      "sha256": "b1cb19dd52d45796d1953b7354aa349c9d9ec3894a7de03b68c32cd28377e6f3"
    }
  },
  {
    "path": "src/shared/transcript/activity/skill-evidence.ts",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 1091,
      "sha256": "b0e1ccff65ecd23b3704002777b31a364be71b565d36c3437718c3b450fd1bea"
    }
  },
  {
    "path": "src/shared/transcript/activity/types.ts",
    "generated": false,
    "base": {
      "bytes": 9890,
      "sha256": "52fe65dce6092db3da030307b5979fa894daf3e0b6668b5c48bfe15ee33c8457"
    },
    "head": {
      "bytes": 11752,
      "sha256": "bd9b53bbcd79b39820d8fcaa8a492088b5efc4dd2302fc3b2fa10a8659618d61"
    }
  },
  {
    "path": "src/shared/transcript/activity/usage.test.ts",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 7180,
      "sha256": "27fc90638bca0d7b66fd51521d7c2c61d76abca613f7c6bec17bac1b79da9c09"
    }
  },
  {
    "path": "src/shared/transcript/activity/usage.ts",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 8283,
      "sha256": "085380a4f28a55aa4471ebd30186965bdf1fff9774af5e3904ebba9d5971cc47"
    }
  },
  {
    "path": "src/skills/session-export-transcript/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 11604,
      "sha256": "8dfbb47e7d1771d22ea1d8837f942c801bdfc5d8a7e925262cdfd52fdf2f5917"
    },
    "head": {
      "bytes": 11604,
      "sha256": "e66343e8128f874082945e117cab3d62024735b3aef6b6ad4d973655eb21c565"
    }
  },
  {
    "path": "src/skills/session-fork-to-destination/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 4422,
      "sha256": "eba04be5359a98a1fc012eb59492c531b9219cadbe873a2c3c5bf0ef09d67797"
    },
    "head": {
      "bytes": 4422,
      "sha256": "1257af86c34aaf8aa3a105f16f9f0a57b5c188df42db45e2a94c53e0bb63fdd8"
    }
  },
  {
    "path": "src/skills/session-observer-collab/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 21541,
      "sha256": "87a9e2df43739db9205912203d4e53077d298479afa50dfc040698d4ffd645f9"
    },
    "head": {
      "bytes": 21541,
      "sha256": "4ed5181a077b02110de9eb4a1d49cc43e4ca98ff36471a5d25d79cee9f2a3e6c"
    }
  },
  {
    "path": "src/skills/session-observer/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 48785,
      "sha256": "a3a0d8ae6fec8467566f801fcf4817b2b31c8cf7b593cf69209b99c1052a6d74"
    },
    "head": {
      "bytes": 48785,
      "sha256": "b3cf3ccf5964f6dfd6464180d69c6b3fa30f47c519c0c8cc1a56638b809288f5"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/watch.ts",
    "generated": false,
    "base": {
      "bytes": 61595,
      "sha256": "2df608d068a5b8370cfe56650f73baa381a3524d7c5c9c7dd6e926459b1bc1c5"
    },
    "head": {
      "bytes": 62577,
      "sha256": "6c54d2ac24de2e77d87b98c60f582207a2c855ea205df724d99d6aba1c960884"
    }
  }
]
```

## Authored before/after diff

```diff
diff --git a/.oat/projects/shared/session-evidence-followups/evidence/p02-codex-read-schema.json b/.oat/projects/shared/session-evidence-followups/evidence/p02-codex-read-schema.json
new file mode 100644
index 00000000..8c79b6eb
--- /dev/null
+++ b/.oat/projects/shared/session-evidence-followups/evidence/p02-codex-read-schema.json
@@ -0,0 +1 @@
+{"commit":"14c35a16a8a41cc16c5e36c2c4287b7b2db6e975","date":"2026-03-25T16:27:32Z","files":[{"filename":"codex-rs/core/src/tools/spec.rs","patch":"@@ -2046,111 +2046,6 @@ fn format_plugin_summary(plugin: \u0026DiscoverablePluginInfo) -\u003e String {\n     }\n }\n \n-fn create_read_file_tool() -\u003e ToolSpec {\n-    let indentation_properties = BTreeMap::from([\n-        (\n-            \"anchor_line\".to_string(),\n-            JsonSchema::Number {\n-                description: Some(\n-                    \"Anchor line to center the indentation lookup on (defaults to offset).\"\n-                        .to_string(),\n-                ),\n-            },\n-        ),\n-        (\n-            \"max_levels\".to_string(),\n-            JsonSchema::Number {\n-                description: Some(\n-                    \"How many parent indentation levels (smaller indents) to include.\".to_string(),\n-                ),\n-            },\n-        ),\n-        (\n-            \"include_siblings\".to_string(),\n-            JsonSchema::Boolean {\n-                description: Some(\n-                    \"When true, include additional blocks that share the anchor indentation.\"\n-                        .to_string(),\n-                ),\n-            },\n-        ),\n-        (\n-            \"include_header\".to_string(),\n-            JsonSchema::Boolean {\n-                description: Some(\n-                    \"Include doc comments or attributes directly above the selected block.\"\n-                        .to_string(),\n-                ),\n-            },\n-        ),\n-        (\n-            \"max_lines\".to_string(),\n-            JsonSchema::Number {\n-                description: Some(\n-                    \"Hard cap on the number of lines returned when using indentation mode.\"\n-                        .to_string(),\n-                ),\n-            },\n-        ),\n-    ]);\n-\n-    let properties = BTreeMap::from([\n-        (\n-            \"file_path\".to_string(),\n-            JsonSchema::String {\n-                description: Some(\"Absolute path to the file\".to_string()),\n-            },\n-        ),\n-        (\n-            \"offset\".to_string(),\n-            JsonSchema::Number {\n-                description: Some(\n-                    \"The line number to start reading from. Must be 1 or greater.\".to_string(),\n-                ),\n-            },\n-        ),\n-        (\n-            \"limit\".to_string(),\n-            JsonSchema::Number {\n-                description: Some(\"The maximum number of lines to return.\".to_string()),\n-            },\n-        ),\n-        (\n-            \"mode\".to_string(),\n-            JsonSchema::String {\n-                description: Some(\n-                    \"Optional mode selector: \\\"slice\\\" for simple ranges (default) or \\\"indentation\\\" \\\n-                     to expand around an anchor line.\"\n-                        .to_string(),\n-                ),\n-            },\n-        ),\n-        (\n-            \"indentation\".to_string(),\n-            JsonSchema::Object {\n-                properties: indentation_properties,\n-                required: None,\n-                additional_properties: Some(false.into()),\n-            },\n-        ),\n-    ]);\n-\n-    ToolSpec::Function(ResponsesApiTool {\n-        name: \"read_file\".to_string(),\n-        description:\n-            \"Reads a local file with 1-indexed line numbers, supporting slice and indentation-aware block modes.\"\n-                .to_string(),\n-        strict: false,\n-        defer_loading: None,\n-        parameters: JsonSchema::Object {\n-            properties,\n-            required: Some(vec![\"file_path\".to_string()]),\n-            additional_properties: Some(false.into()),\n-        },\n-        output_schema: None,\n-    })\n-}\n-\n fn create_list_dir_tool() -\u003e ToolSpec {\n     let properties = BTreeMap::from([\n         (\n@@ -2704,7 +2599,6 @@ pub(crate) fn build_specs_with_discoverable_tools(\n     use crate::tools::handlers::McpHandler;\n     use crate::tools::handlers::McpResourceHandler;\n     use crate::tools::handlers::PlanHandler;\n-    use crate::tools::handlers::ReadFileHandler;\n     use crate::tools::handlers::RequestPermissionsHandler;\n     use crate::tools::handlers::RequestUserInputHandler;\n     use crate::tools::handlers::ShellCommandHandler;\n@@ -2975,20 +2869,6 @@ pub(crate) fn build_specs_with_discoverable_tools(\n         builder.register_handler(\"apply_patch\", apply_patch_handler);\n     }\n \n-    if config\n-        .experimental_supported_tools\n-        .contains(\u0026\"read_file\".to_string())\n-    {\n-        let read_file_handler = Arc::new(ReadFileHandler);\n-        push_tool_spec(\n-            \u0026mut builder,\n-            create_read_file_tool(),\n-            /*supports_parallel_tool_calls*/ true,\n-            config.code_mode_enabled,\n-        );\n-        builder.register_handler(\"read_file\", read_file_handler);\n-    }\n-\n     if config\n         .experimental_supported_tools\n         .iter()"}],"parents":["c6ffe9abab04bd3349ecc49fffc0fbf9551826e6"],"url":"https://github.com/openai/codex/commit/14c35a16a8a41cc16c5e36c2c4287b7b2db6e975"}
diff --git a/.oat/projects/shared/session-evidence-followups/evidence/p02-cursor-carrier-scan.txt b/.oat/projects/shared/session-evidence-followups/evidence/p02-cursor-carrier-scan.txt
new file mode 100644
index 00000000..c78267c9
--- /dev/null
+++ b/.oat/projects/shared/session-evidence-followups/evidence/p02-cursor-carrier-scan.txt
@@ -0,0 +1,16 @@
+Cursor structured read carrier scan receipt
+Date: 2026-09-20
+Source scope: ~/.cursor/projects/**/*.jsonl
+Files surveyed: 1297
+Method: parsed JSONL; counted assistant message.content[] blocks with type=tool_use and exact name Read or ReadFile; recorded only sorted input key names and aggregate counts; no argument values or message bodies emitted.
+Total Read/ReadFile carriers: 45481
+Exact path values whose basename is SKILL.md: 3091
+
+ReadFile {path}: 21576
+ReadFile {limit,offset,path}: 16885
+Read {limit,offset,path}: 2680
+Read {path}: 2354
+ReadFile {limit,path}: 859
+Read {limit,path}: 747
+ReadFile {offset,path}: 265
+Read {offset,path}: 115
diff --git a/.oat/projects/shared/session-evidence-followups/implementation.md b/.oat/projects/shared/session-evidence-followups/implementation.md
index a983d29c..6b2641dd 100644
--- a/.oat/projects/shared/session-evidence-followups/implementation.md
+++ b/.oat/projects/shared/session-evidence-followups/implementation.md
@@ -1,30 +1,30 @@
 ---
 oat_status: in_progress
 oat_ready_for: null
 oat_blockers: []
 oat_last_updated: 2026-09-20
-oat_current_task_id: p02-t01
+oat_current_task_id: p03-t01
 oat_generated: false
 ---
 
 # Implementation: session-evidence-followups
 
 ## Progress Overview
 
 | Phase | Status  | Tasks | Completed |
 | ----- | ------- | ----- | --------- |
 | p00   | complete | 1     | 1/1       |
 | p01   | complete | 2     | 2/2       |
-| p02   | pending | 2     | 0/2       |
+| p02   | review_pending | 2     | 2/2       |
 | p03   | pending | 1     | 0/1       |
 | p04   | pending | 1     | 0/1       |
 
-**Total:** 3/7 tasks completed.
+**Total:** 5/7 tasks completed.
 
 ## Orchestration Runs
 
 ### Run 1 — 2026-09-20
 
 One branch/PR: backlog-review-2026-09-20. Native Sol phase implementation, user-selected Opus through Consensus Review. High ceiling, no parallel product phases because shared generated payload/version ownership overlaps. Read-only recon ran concurrently. IMPLEMENT-03: final checkpoint p04, autonomous continuation authorized by user. Additional requested timeout adjustment executes first as p00.
 
 ### p00 — completed
@@ -62,16 +62,30 @@ Independent Opus review run `446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4` passed with z
 M1 accepted: preserve meaningful aborted/truncated assistant output; suppress provider API-error bodies only with explicit filtered accounting and documented behavior. M2 accepted: native Claude message IDs span records; fold explicit-abort evidence across prior same-session blocks, with tests for non-final abort flags and later-only/orphan references. Root additionally observed that the existing map could join a future assistant record, contrary to the plan's prior-record requirement; fix in the same join scope. L1 accepted: stop/heartbeat documentation and printed label must describe delivered delta plus terminal events. Retry suffix whitespace question declined: strict observed grammar is intentional; no unsupported locale/whitespace inference is required. Cursor metadata frames already lack narrative content, so preserving meaningful Claude partial output resolves the apparent asymmetry.
 
 Same Sol handle receives bounded continuation `evidence-p01-fix1-20260920`, linked to `evidence-p01-20260920`; no replacement or target change. Review passed does not waive these accepted fixes or their verification. A bounded independent follow-up will verify the changes.
 
 Fix continuation completed as `82ea5a103497aa8210035a889e256f07cb5cafa9`, exactly one append-only commit from `a3f782c4da52ab0a02cdd0869904e41e6f6e32ca`. Root inspected the native join and digest accounting diff; clean worktree verified. M1/M2/L1 implemented, including root's future-only pointer and double-accounting checks. Observer1.0.74, collab1.0.62, export2.0.25 and fork0.2.39. Watcher60/60, shared decoder/activity34/34, digest62/62, collab199/199; types, build/freshness, validate, version checks, scoped lint/format and docs build passed. Signal/rearm mechanics unchanged; retained 50-run stress proof remains applicable. One nonblocking fix round, no implementation recovery attempts. Focused independent verification review pending.
 
 Bounded independent verification run `c47f8d9e-a43b-48e3-b790-fdf445abf041` passed: zero Critical/High/Medium, all original M1/M2/L1 fixes verified. [Canonical review](reviews/p01-opus-fix-verification.md), [packet](evidence/p01-fix-review-packet.md), packet SHA256 `e62eeba813f08ef151da7ec6b7ea819e4d704db2867fdcc2bd21a9ae2dd9b359`; reviewed HEAD `c7b17f4455e20d2231c92caf210c252faefce822`. Requested Opus/high, actual model/effort unobserved by wrapper. One new Low changelog wording issue accepted and fixed by same Sol handle in `a9f409b28d916beef6105e2dc0fd369be349580a`; root inspected exact one-file diff, scoped formatting/self-review passed. It accurately distinguishes runtime changes from conservative transitive source version-validation bumps. No runtime change followed the passing review. Independent final integration review still covers the complete delta.
 
+### p02 — implementation completed; independent review pending
+
+Request `evidence-p02-20260920`, native `/root/p02_activity_metadata`, exact role `oat-phase-implementer-gpt-5-6-sol-high`; High policy, hard-reasoning class for native identity, source metadata budgets and usage semantics. Base `6d863965848d699afa09cd075d2295e57772be34`. User-selected Sol/high remains available in the live native catalog; dated guidance is review-required, incumbent retained with current user authorization and passing prior-phase evidence. Configured invocation evidence does not prove observed runtime identity. No nested workers, no recovery attempts. Root verified exactly two task commits and clean tree, and inspected skill projection/watch seams and usage extraction.
+
+`Dispatch: scope=p02 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`
+
+Task1 `47534bf965b04a15774ac2c993ca32d00b6a656f`: native Claude attribution/invocation and names-only available/invoked attachments; exact Cursor Read/ReadFile.path and historical Codex read_file.file_path inference. Shell/prose, aliases and wrong keys stay unclassified. Source metadata is captured-source, budgeted with omissions; watcher avoids replaying source-wide metadata. Focused activity77/77, relevant consumers863/863, final focused372/372; types, build/freshness, validate, version closure, scoped lint/format, docs production58 pages and self-review passed.
+
+Native evidence: [Cursor aggregate receipt](evidence/p02-cursor-carrier-scan.txt), SHA256 `d15ca623c59aa0c525aaedb7a3f4669a787b67ae9936f71313afca1114b07b87`, surveys1297 JSONL files,45481 structured Read/ReadFile carriers,3091 SKILL.md paths. Root verified official Codex [removal commit](https://github.com/openai/codex/commit/14c35a16a8a41cc16c5e36c2c4287b7b2db6e975), parent `c6ffe9abab04bd3349ecc49fffc0fbf9551826e6`: exact experimental read_file function schema required file_path. [Retained upstream schema receipt](evidence/p02-codex-read-schema.json). Carrier was removed2026-03-25 and absent from recent local samples. Historical native decoding satisfies the direct-read criterion without claiming current shell reads are classified; no speculative tool aliases or command parsing were added.
+
+Optional parallel preparation: same Sol/medium handle `/root/p00_timeout` produced read-only p04 draft `/tmp/evidence-p04-retro-draft.md` (SHA256 b872aabb96b383adde61bcc92048d23930f6861e81e990bdf63159767bf5fb77) under request `evidence-p04-draft-20260920`, then p03 preflight `/tmp/evidence-p03-preflight.md` (SHA25640e3fba73549a2d131ad4ee76271aa454abd871d258999cb7005ddfe0c6efc9d) under `evidence-p03-preflight-20260920`. A prior fresh optional draft worker launch was rejected before start for host thread limit; no child started, and existing exact Sol/medium handle performed the bounded preparation. These preparations made no repo mutations and are not phase implementation. Root rejected preflight suggestions to substitute filename identity for Claude/Codex native-record evidence and to fail every partial capture; corrected artifact requires native-record identity and honest partial coverage. Product phases stay sequential.
+
+Task2 `92b688f9fa95cd5bd8bc9d4d6267c995134ecdfa`: native Claude exact-session/message dedup with conflict/uncertainty diagnostics; Codex separate cumulative, last-turn and response samples, reset segmentation and evidenced model joins; Cursor not-recorded, no prices or computed totals. Full phase verification: activity80/80; relevant activity/observer/export/collaboration866/866; types, build/freshness, repository validate, baseline version closure, scoped lint/format, diff check and docs production58 pages passed. No uncommitted changes or concerns reported. Independent Opus phase review pending.
+
 ## Task Records
 
 ### Task p00-t01: Give Consensus Review fifteen minutes by default
 
 **Status:** completed
 **Commit:** 852be12cf67f5231f481dd97ce741e057d841937
 **Outcome:** Provider dispatch defaults to 900 seconds with explicit internal overrides retained; host budget guidance added in 37f2832f.
 **Verification:** 25 focused tests, typecheck, build/freshness, version gate, docs build and independent Opus pass; details in p00 above.
@@ -85,16 +99,30 @@ Bounded independent verification run `c47f8d9e-a43b-48e3-b790-fdf445abf041` pass
 
 ### Task p01-t02: Emit unsuccessful terminal metadata
 
 **Status:** completed
 **Commit:** 83b36bf602c26a7309ed1e2b6e173ccf83a0798a
 **Outcome:** Claude/Codex/Cursor metadata-only terminal watch events, existing checkpoint dedup and bounded inferred retry fragments. Accepted review fixes are implemented and independently verified above.
 **Verification:** Watcher60, decoder/activity32, collaboration199 tests and phase gates passed; independent review pass with accepted follow-up findings.
 
+### Task p02-t01: Attribute skill activity without instruction bodies
+
+**Status:** completed
+**Commit:** 47534bf965b04a15774ac2c993ca32d00b6a656f
+**Outcome:** Native and inferred skill evidence, names-only source metadata, budgeted projection and watch delivery integration.
+**Verification:** Focused and consumer suites, native carrier evidence, generated/version/docs gates and self-review passed; independent phase review pending.
+
+### Task p02-t02: Preserve honest token accounting
+
+**Status:** completed
+**Commit:** 92b688f9fa95cd5bd8bc9d4d6267c995134ecdfa
+**Outcome:** Captured-source native usage samples retain separate semantics, model evidence and diagnostics without invented totals or pricing.
+**Verification:** Activity80/80, relevant consumers866/866 and generated/version/docs gates; self-review passed, independent phase review pending.
+
 ## Implementation Log
 
 - Plan committed and reviewed; initial response-format failures preserved as diagnostics, not passes. Valid review found one High native retry-grammar issue; bounded fix verification passed with zero findings.
 - Root complexity pass complete, no material runtime simplification required. Baseline generated-output freshness passed.
 - Task-specific evidence and commits will be recorded here after each child returns. Root does not mutate the checkout while a child owns implementation or while Consensus reviews it.
 
 ## Deviations from Plan / Design
 
@@ -106,17 +134,17 @@ Bounded independent verification run `c47f8d9e-a43b-48e3-b790-fdf445abf041` pass
 ## Test Results
 
 | Scope    | Command              | Result                                                 |
 | -------- | -------------------- | ------------------------------------------------------ |
 | Baseline | pnpm run build:check | Passed; /tmp/session-evidence-baseline-build-check.log |
 
 ## Final Summary (for PR/docs)
 
-p00 completed: Consensus Review defaults to 900 seconds with explicit internal overrides preserved. p01 implements reliable rearm testing and metadata-only unsuccessful terminal signals across Claude, Codex and Cursor. Four backlog tasks remain; no tickets closed. Draft PR [#99](https://github.com/tkstang/skills/pull/99) is open; implementation and acceptance continue.
+p00 completed: Consensus Review defaults to 900 seconds with explicit internal overrides preserved. p01 implements reliable rearm testing and metadata-only unsuccessful terminal signals across Claude, Codex and Cursor. Two backlog tasks remain; p02 skill and usage implementation is complete pending independent review. No tickets closed. Draft PR [#99](https://github.com/tkstang/skills/pull/99) is open; implementation and acceptance continue.
 
 ## References
 
 - [Plan](plan.md)
 - [Discovery](discovery.md)
 - [Review dispositions](reviews/archived/plan-review-disposition.md)
 - [Complexity review](reviews/archived/complexity-review.md)
 
diff --git a/.oat/projects/shared/session-evidence-followups/plan.md b/.oat/projects/shared/session-evidence-followups/plan.md
index 6fabe895..f49da412 100644
--- a/.oat/projects/shared/session-evidence-followups/plan.md
+++ b/.oat/projects/shared/session-evidence-followups/plan.md
@@ -168,17 +168,17 @@ Close each fully satisfied item via repo Backlog Lifecycle: status/updated, comp
 | p00 | code | passed | 2026-09-20 | reviews/archived/p00-opus-review.md | - | manual | - |
 
 | p01 | code | passed | 2026-09-20 | reviews/p01-opus-fix-verification.md | - | manual | - |
 
 Spec/design rows are retained template history; quick mode uses discovery and this plan only. Full reviewed plan plus the clean bounded H1 verification establish readiness. [Complexity review](reviews/archived/complexity-review.md) retains the minimum sufficient approach. The subsequently user-requested 600→900 timeout task is a narrow operational addition; its requirements are explicit above and it receives self-review and independent Opus code review, without repeating the unchanged six-ticket plan review.
 
 ## Implementation Complete
 
-Phases 0–1 implemented and independently reviewed. Phase 0: 1 task; Phase 1: 2 tasks; Phase 2: 2 tasks; Phase 3: 1 task; Phase 4: 1 task. **Total: 7 tasks, 3 complete.** Final acceptance/delivery remains mandatory after product phases.
+Phases 0–1 implemented and independently reviewed. Phase2 implemented, independent review pending. Phase 0: 1 task; Phase 1: 2 tasks; Phase 2: 2 tasks; Phase 3: 1 task; Phase 4: 1 task. **Total: 7 tasks, 5 complete.** Final acceptance/delivery remains mandatory after product phases.
 
 ## References
 
 - [Discovery](discovery.md)
 - [Backlog review](../../../repo/pjm/backlog/reviews/backlog-and-roadmap-review.md)
 - Native schemas: `documentation/docs/engineering/architecture/session-schemas/`
 - Retained structure research: `.oat/repo/reference/research/session-schemas-2026-09-18/`
 - [BL-260919-stabilize-the-watcher-sigterm](../../../repo/pjm/backlog/items/BL-260919-stabilize-the-watcher-sigterm.md)
diff --git a/.oat/projects/shared/session-evidence-followups/project-log.md b/.oat/projects/shared/session-evidence-followups/project-log.md
index e53135d7..d38e93e6 100644
--- a/.oat/projects/shared/session-evidence-followups/project-log.md
+++ b/.oat/projects/shared/session-evidence-followups/project-log.md
@@ -43,11 +43,15 @@ Entries are chronological and append-only.
 ### 2026-09-20 · structural · oat-project-implement · p00
 
 p00 passed independent Consensus review 8c84e955-3f2e-4817-afd8-a7d08531875b; nonblocking docs follow-up accepted, zero blocking fix rounds; see implementation.md.
 
 ### 2026-09-20 · structural · oat-project-implement · p01
 
 p01 passed full and bounded independent Opus reviews; one nonblocking fix round plus docs clarification; review c47f8d9e-a43b-48e3-b790-fdf445abf041, evidence in implementation.md.
 
+### 2026-09-20 · structural · oat-project-implement · p02
+
+evidence-p02-outcome-20260920: two Sol task commits verified; phase checks and self-review pass, independent Opus review pending; see implementation.md.
+
 ## End-of-run synthesis (pending — do not skip at project completion)
 
 Summarize the overall verdict, adopted adjustments, and entries graduated to the repo ledger or backlog. Roll up durable observations into tracked surfaces before archiving this project log.
diff --git a/.oat/projects/shared/session-evidence-followups/state.md b/.oat/projects/shared/session-evidence-followups/state.md
index 058e191c..6f1a7f15 100644
--- a/.oat/projects/shared/session-evidence-followups/state.md
+++ b/.oat/projects/shared/session-evidence-followups/state.md
@@ -1,11 +1,11 @@
 ---
-oat_current_task: p02-t01
-oat_last_commit: a9f409b28d916beef6105e2dc0fd369be349580a
+oat_current_task: p03-t01
+oat_last_commit: 92b688f9fa95cd5bd8bc9d4d6267c995134ecdfa
 oat_blockers: []
 associated_issues:
   - { type: backlog, ref: 'BL-260919-stabilize-the-watcher-sigterm' }
   - { type: backlog, ref: 'BL-260919-surface-terminally' }
   - { type: backlog, ref: 'BL-260919-skill-attribution-in-session' }
   - { type: backlog, ref: 'BL-260919-token-and-usage-accounting' }
   - { type: backlog, ref: 'BL-260919-uncapped-structured-activity' }
   - { type: backlog, ref: 'BL-260919-session-retro-consume-activity' }
@@ -80,17 +80,17 @@ oat_workflow_origin: native # native | imported
 #   receive_completed: false
 #   failure: null
 #   updated_at: '2026-07-18T00:00:00Z'
 oat_docs_updated: null # null | skipped | complete — documentation sync status
 oat_pr_status: open
 oat_pr_url: https://github.com/tkstang/skills/pull/99
 oat_project_created: '2026-09-20T19:09:21.094Z' # ISO 8601 UTC timestamp — set once at project creation
 oat_project_completed: null # ISO 8601 UTC timestamp — set when project is completed/archived
-oat_project_state_updated: '2026-09-20T22:10:34.302234+00:00'
+oat_project_state_updated: '2026-09-20T22:45:45.782940+00:00'
 oat_dispatch_policy:
   mode: managed
   policy: high
   source: project-state
 oat_skill_gate_overrides:
   oat-project-quick-start: disabled
   oat-project-implement: disabled
 oat_generated: false
@@ -99,38 +99,39 @@ oat_generated: false
 # Project State: session-evidence-followups
 
 **Status:** Implementation
 **Started:** 2026-09-20
 **Last Updated:** 2026-09-20
 
 ## Current Phase
 
-p00 complete and independently reviewed. p01 implementation and independent reviews complete; p02 skill/usage metadata is next. User authorized continuation through one mergeable PR.
+p00 and p01 complete and independently reviewed. p02 skill/usage implementation complete; independent Opus review is next before p03. User authorized continuation through one mergeable PR.
 
 ## Artifacts
 
 - **Discovery:** `discovery.md` (complete)
 - **Spec:** N/A (quick mode)
 - **Design:** N/A (quick mode unless lightweight design is needed)
 - **Plan:** `plan.md` (complete and reviewed)
-- **Implementation:** `implementation.md` (3/7 tasks complete)
+- **Implementation:** `implementation.md` (5/7 tasks complete)
 
 ## Progress
 
 - ✓ Discovery complete
 - ✓ Execution artifacts scaffolded
 - ✓ Plan Opus review and complexity pass complete
 - ✓ p00 timeout implemented and independently reviewed
 - ✓ p01 watcher implemented and independently reviewed
-- ⧗ p02 skill and usage metadata next
+- ✓ p02 skill and usage implementation complete
+- ⧗ p02 independent review pending
 
 ## Blockers
 
 None
 
 ## Next Milestone
 
-Implement p02 native skill attribution and honest usage accounting
+Review p02, then implement p03 complete structured capture
 
 ## Review routing for this authorized run
 
 User selected Opus via Consensus Review for plan, phase and final reviews. Project-local lifecycle gate overrides prevent duplicate configured reviews; they do not claim a disabled gate passed. This run still requires the user-selected independent reviews. Shared/user gate configuration is unchanged. IMPLEMENT-03 resolves the final phase checkpoint to p04; user authorized continuing through delivery without intermediate pauses. Post-implementation sequence resolved from shared config: summary, document, PR; postApproval empty. No merge authorization.
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 3217eb76..d5496415 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,14 +1,31 @@
 # Changelog
 
 ## [Unreleased]
 
 ### Added
 
+- `session-observer` 1.0.76 and `session-export-transcript` 2.0.27 add
+  captured-source token metadata with exact Claude Code message deduplication,
+  separate Codex cumulative, last-turn, and response semantics, explicit reset
+  and uncertainty diagnostics, model attribution only from native joins, and
+  Cursor `not-recorded` status. `session-observer-collab` 1.0.64 and
+  `session-fork-to-destination` 0.2.41 receive the shared runtime closure while
+  their default behavior remains unchanged.
+
+- `session-observer` 1.0.75 and `session-export-transcript` 2.0.26 add
+  captured-source skill metadata, native Claude Code attribution and structured
+  Skill invocation evidence, inferred Cursor `Read`/`ReadFile` skill-file
+  loads, and the historical experimental Codex `read_file.file_path` carrier
+  without parsing shell commands or instruction bodies.
+  `session-observer-collab` 1.0.63 and `session-fork-to-destination` 0.2.40
+  receive the shared activity runtime closure while their default behavior
+  remains unchanged.
+
 - `session-observer` 1.0.73 reports metadata-only unsuccessful terminal turns
   from native Claude Code, Codex, and Cursor lifecycle evidence while preserving
   exact-range checkpoint deduplication and keeping terminal events visible under
   `--quiet-empty`. `session-observer-collab` 1.0.61 proves those events do not
   create peer-message authority; `session-export-transcript` 2.0.24 and
   `session-fork-to-destination` 0.2.38 receive the shared transcript decoder
   closure without changing their user-facing behavior.
 
diff --git a/documentation/docs/engineering/architecture/session-schemas/claude-code.md b/documentation/docs/engineering/architecture/session-schemas/claude-code.md
index fe1a4e06..a47a751e 100644
--- a/documentation/docs/engineering/architecture/session-schemas/claude-code.md
+++ b/documentation/docs/engineering/architecture/session-schemas/claude-code.md
@@ -300,16 +300,23 @@ use two, 5 use three, 9 have none; all 171 sampled subagent files use exactly on
 
 **Streaming duplication — a double-counting hazard.** Assistant records are written **one
 per content block**, not one per API response: each carries `apiBlockIndex` (25,303) and
 repeats the same `message.id`. Of 23,715 `(file, message.id)` groups, 17,027 have more
 than one record and only 6,688 are singletons, while `message.usage` is present on all
 50,261 assistant records, so summing usage naively over-counts by roughly 2×.
 **Deduplicate on `(sessionId, message.id)` before aggregating usage.**
 
+The activity reader follows that boundary across content-block records. Equal
+copies collapse; conflicting copies produce a diagnostic and only one copy is
+retained. A usage carrier without `message.id` remains explicitly uncertain and
+is not deduplicated. `message.model` is the only model attached to that sample.
+Only token-valued fields are reported; service tier, geography, speed, and
+server-tool request counts are excluded.
+
 **`message.usage` fields** (n = 50,261): `input_tokens`, `output_tokens`,
 `cache_creation_input_tokens`, `cache_read_input_tokens` and `cache_creation` are present
 on 100%; `service_tier` (50,223 / null 38), `inference_geo` (same split),
 `output_tokens_details` (36,837 / null 33), `server_tool_use` (39,791), `iterations`
 (39,753 / null 38) and `speed` (39,753 / null 38) are partial. `message.diagnostics`
 (object or null, 50,173) carries `cache_miss_reason.{type, cache_missed_input_tokens}`
 (620).
 
@@ -341,16 +348,25 @@ tail carries the structural signals cited elsewhere on this page, including
 
 **Attribution fields** on `assistant` records: `attributionAgent` 16,101,
 `attributionSkill` 9,800, `attributionMcpServer` / `attributionMcpTool` 82,
 `attributionPlugin` 22, `advisorModel` 373. **Slash commands** have no structured record
 type: they appear as `user.message.content` strings containing `<command-name>` (130
 files) and `<local-command-stdout>` (70), and as `system` records with
 `subtype: local_command` (40).
 
+`attributionSkill` is a top-level assistant-record field, not a member of
+`message`. A `tool_use` whose native name is `Skill` is separate structural
+invocation evidence, and its structured input may name the skill. Names-only
+source metadata also appears in `attachment.type == "skill_listing"` at
+`attachment.names[]` (availability) and `attachment.type == "invoked_skills"`
+at `attachment.skills[].name` (recorded invocation). Attachment content and path
+bodies are not needed for these names. None of these carriers records a skill
+version.
+
 ## 9. Externally persisted output and sizes
 
 Large Bash output is written to a sidecar file and referenced two ways that do not carry
 the same information. In the transcript text, the `tool_result` content contains a bare
 `<persisted-output>` marker (270 occurrences in the sample; no attributes observed on the
 tag). The **path** appears only in the sibling `toolUseResult.persistedOutputPath`,
 alongside `persistedOutputSize` — 254 carriers, all on `Bash`. A reader consuming only
 `message.content[type == "tool_result"]` sees the marker and cannot resolve it. Every
diff --git a/documentation/docs/engineering/architecture/session-schemas/codex.md b/documentation/docs/engineering/architecture/session-schemas/codex.md
index 95198480..11915db0 100644
--- a/documentation/docs/engineering/architecture/session-schemas/codex.md
+++ b/documentation/docs/engineering/architecture/session-schemas/codex.md
@@ -311,21 +311,39 @@ rather than merging them, or the same bytes will appear twice.
 | Concern                    | Where it lives                                                                                                                                                                  |
 | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 | Model and reasoning effort | Per-turn `turn_context`, not `session_meta`. `session_meta` records `model_provider` only. Because the value is per turn, mid-session model and effort switches are observable. |
 | Token usage                | `token_count.info` with `total_token_usage` (cumulative) and `last_token_usage` (per turn).                                                                                     |
 | Response-joinable usage    | `token_usage_record` (thread, turn, root-turn, and response ids). The only usage record joinable to a response; present in 9 of 22 versions.                                    |
 | Compaction                 | `compacted`, carrying a window chain: `first_window_id` → `previous_window_id` → `window_id`, plus `window_number`, `retained_context`, `guardian_history`.                     |
 | Reasoning                  | `encrypted_content` on 99.4% of reasoning records. A plaintext `summary` is non-empty on 45%.                                                                                   |
 
+Codex has no native skill-invocation or skill-version field in the observed
+transcripts. Historical Codex builds did expose an experimental native
+`read_file` function with JSON arguments containing required `file_path` and
+optional `offset`, `limit`, `mode`, and `indentation`; upstream removed it on
+2026-03-25 in commit
+[`14c35a16`](https://github.com/openai/codex/commit/14c35a16a8a41cc16c5e36c2c4287b7b2db6e975).
+The reader recognizes only that exact native name and path key. The carrier is
+absent from the recent local sample. Current shell reads, aliases, and prose
+mentions are not equivalent evidence.
+
 The cumulative counter is not strictly monotonic: it rose in 46,450 of 46,523
 comparisons, and all 73 decreases sit at compaction boundaries. A reader that assumes
 monotonicity will compute negative deltas at exactly those points; treat a decrease as a
 compaction signal, not as corrupt data.
 
+The activity reader preserves `total_token_usage`, `last_token_usage`, and
+`token_usage_record` as separate semantics. Identical token-count snapshots are
+collapsed; a cumulative decrease starts a numbered segment and emits a reset
+diagnostic rather than a negative delta. Response usage can inherit a model only
+when its recorded `turn_id` joins a `turn_context`; totals and last-turn records
+remain model-unknown when no native join exists. No counter is converted to
+price or cost.
+
 ## Output size limits
 
 | Measurement                         | Value                                                         |
 | ----------------------------------- | ------------------------------------------------------------- |
 | Response-item output payload size   | p50 920 B · p99 40,147 B · max 399,386 B; none exceeded 1 MB. |
 | `item.stdout` / `aggregated_output` | Peak at exactly **1,048,608 bytes** across independent files. |
 | `formatted_output`                  | Peaks at exactly **40,109 bytes** across independent files.   |
 | `stderr`                            | Empty in every record observed.                               |
diff --git a/documentation/docs/engineering/architecture/session-schemas/cursor.md b/documentation/docs/engineering/architecture/session-schemas/cursor.md
index dee9466e..42bc627b 100644
--- a/documentation/docs/engineering/architecture/session-schemas/cursor.md
+++ b/documentation/docs/engineering/architecture/session-schemas/cursor.md
@@ -132,16 +132,20 @@ different sample from the findings report, which observed 25 names in 350 files)
 `StrReplace` 2,034 · `Grep` 1,427 · `Glob` 1,270 · `AwaitShell` 610 · `Subagent` 484 ·
 `CallMcpTool` 435 · `TodoWrite` 404 · `Write` 221 · `Delete` 205 · `AskQuestion` 182 ·
 `GetMcpTools` 151 · `CallDynamicTool` 113 · `GetDynamicTools` 106 · `WebFetch` 60 ·
 `WebSearch` 56 · `Task` 34 · `ReadLints` 8 · `SwitchMode` 7 · `CreatePlan` 4.
 
 The two samples do not list the same names. Tool names are an open set — a parser must
 not reject an unknown name.
 
+Cursor records no native skill-invocation or skill-version field. `ReadFile`
+and `Read` calls can support inferred file-load evidence when their structured
+input path ends in `SKILL.md`; a `Shell` command or prose mention does not.
+
 ## Tool results: not recorded
 
 **Zero tool results exist in the corpus.** 0 of 1,295 files contain `tool_result`,
 `tool_use_id`, or `is_error`; 0 of 44,041 recorded calls have a result.
 
 Results are not-recorded by construction across the full 1,295-file corpus, and that changes what any
 activity or outcome model can honestly say about Cursor:
 
@@ -296,16 +300,18 @@ structured `questions[]` / `options[]`.
 `src/shared/transcript/cursor-frames.ts` is **uncontradicted** by this evidence. The two
 Cursor claims in `10-schema-guide-and-coverage.md` are supported.
 
 ## Not observed / not determined
 
 - `status: "cancelled"` — not observed in 350 files.
 - Any tool result, call id, or per-call outcome — not present corpus-wide.
 - Any timestamp, usage, model, or version metadata — not present.
+- The activity reader therefore reports token usage as `not-recorded`, never as
+  a numeric zero.
 - Streaming, partial, or superseded-revision markers — not present in settled files.
 - Attribution of an `agent-tools/` file to the call that produced it — not recoverable.
 - Whether a file is one conversation or one turn — undetermined.
 - Whether the ~15 KB spill threshold is real — inferred, not confirmed.
 - Shape drift across Cursor versions — untestable, since no version field exists.
 
 ## Fixture checklist
 
diff --git a/documentation/docs/engineering/architecture/session-schemas/index.md b/documentation/docs/engineering/architecture/session-schemas/index.md
index 1cb13e2f..6a250bf8 100644
--- a/documentation/docs/engineering/architecture/session-schemas/index.md
+++ b/documentation/docs/engineering/architecture/session-schemas/index.md
@@ -25,42 +25,56 @@ these files, and they change between client releases.
 - **Structure only.** The pages contain field paths, JSON types, enum vocabulary, and
   counts. Examples are skeletons with placeholders. No recorded content is reproduced.
 - **Evidence strength is explicit.** A native id that links two records is strong
   evidence. A link inferred from turn, order, or position is weaker and is labelled as
   such. A missing field is never treated as proof of success.
 
 ## Cross-runtime comparison
 
-| Question                     | Codex                                                                                                | Claude Code                                                                                                                                                           | Cursor                                                               |
-| ---------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
-| Client version in transcript | Yes (`session_meta.payload.cli_version`)                                                             | Yes (`version` on records)                                                                                                                                            | No                                                                   |
-| Timestamps                   | Yes                                                                                                  | Yes                                                                                                                                                                   | No                                                                   |
-| File identity                | First `session_meta` `payload.id`, equal to the filename uuid                                        | `sessionId`; one per file                                                                                                                                             | The file path only                                                   |
-| Native tool-call id          | `call_id`                                                                                            | `tool_use.id` / `tool_result.tool_use_id`                                                                                                                             | None; identity is positional                                         |
-| Tool results recorded        | Yes                                                                                                  | Yes                                                                                                                                                                   | No                                                                   |
-| Structured exit code         | Yes, in the separate `item_completed` stream only                                                    | No                                                                                                                                                                    | No                                                                   |
-| Per-call failure flag        | `item.status` in the `item_completed` stream (attributing it to a specific call is an inferred join) | `is_error: true` on the result block                                                                                                                                  | None; turn-level `turn_ended.status` only                            |
-| Subagent transcripts         | Separate rollout file; `id != session_id`                                                            | Separate file under `<session-id>/subagents/` plus `.meta.json`                                                                                                       | Separate file under `<session-id>/subagents/`                        |
-| Parent names its children    | Yes, via `SubAgentActivity.agent_thread_id`                                                          | Yes for directly spawned subagents, via the `Agent` tool result's agent id and the child's `.meta.json` `toolUseId`; workflow-spawned children join by directory only | Partly; child id appears in the parent in a minority of pairs        |
-| Oversized tool output        | Truncated in place at fixed byte caps, no marker                                                     | Persisted to `<session-id>/tool-results/`; path only in `toolUseResult.persistedOutputPath`                                                                           | Probably spilled to `agent-tools/` files, not attributable to a call |
-| Token usage                  | Cumulative and per-turn records                                                                      | Per message, repeated on every content-block record                                                                                                                   | None                                                                 |
+| Question                     | Codex                                                                                                | Claude Code                                                                                                                                                           | Cursor                                                                |
+| ---------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
+| Client version in transcript | Yes (`session_meta.payload.cli_version`)                                                             | Yes (`version` on records)                                                                                                                                            | No                                                                    |
+| Timestamps                   | Yes                                                                                                  | Yes                                                                                                                                                                   | No                                                                    |
+| File identity                | First `session_meta` `payload.id`, equal to the filename uuid                                        | `sessionId`; one per file                                                                                                                                             | The file path only                                                    |
+| Native tool-call id          | `call_id`                                                                                            | `tool_use.id` / `tool_result.tool_use_id`                                                                                                                             | None; identity is positional                                          |
+| Tool results recorded        | Yes                                                                                                  | Yes                                                                                                                                                                   | No                                                                    |
+| Structured exit code         | Yes, in the separate `item_completed` stream only                                                    | No                                                                                                                                                                    | No                                                                    |
+| Per-call failure flag        | `item.status` in the `item_completed` stream (attributing it to a specific call is an inferred join) | `is_error: true` on the result block                                                                                                                                  | None; turn-level `turn_ended.status` only                             |
+| Subagent transcripts         | Separate rollout file; `id != session_id`                                                            | Separate file under `<session-id>/subagents/` plus `.meta.json`                                                                                                       | Separate file under `<session-id>/subagents/`                         |
+| Parent names its children    | Yes, via `SubAgentActivity.agent_thread_id`                                                          | Yes for directly spawned subagents, via the `Agent` tool result's agent id and the child's `.meta.json` `toolUseId`; workflow-spawned children join by directory only | Partly; child id appears in the parent in a minority of pairs         |
+| Oversized tool output        | Truncated in place at fixed byte caps, no marker                                                     | Persisted to `<session-id>/tool-results/`; path only in `toolUseResult.persistedOutputPath`                                                                           | Probably spilled to `agent-tools/` files, not attributable to a call  |
+| Token usage                  | Cumulative and per-turn records                                                                      | Per message, repeated on every content-block record                                                                                                                   | None                                                                  |
+| Skill evidence               | Historical experimental `read_file.file_path`; removed upstream March 2026 and absent locally        | Top-level `attributionSkill`, structured `Skill` calls, and names-only availability/invocation attachments                                                            | Inferred from structured `Read`/`ReadFile` paths ending in `SKILL.md` |
 
 ## Reader requirements that follow from the evidence
 
 - Split records on the LF byte only. U+2028 and U+2029 occur unescaped inside string
   values; the abandoned scanner treated them as record boundaries and reported valid
   records as malformed, while LF-byte splitting parsed the sampled records.
 - Do not assume one header per file (Codex child files can carry an inherited parent
   header) or one record per logical message (Claude Code writes one assistant record
   per content block).
 - Do not use a message or item `id` where a call id is required. In Codex the two
   differ in almost every call.
 - Treat inherited parent history in Codex child files as context, not as the child's
   own activity.
+- Keep native skill attribution, recorded invocation, availability, and inferred
+  direct file reads as separate evidence. Do not parse shell commands, prose, or
+  instruction bodies to manufacture a skill load.
+
+None of the three native transcript formats records a skill version. An
+installed-file or Git revision selected for the transcript timestamp is inferred
+context, may be unknown, and cannot prove the revision that executed.
+
+The activity reader keeps usage as captured-source metadata. It deduplicates
+Claude Code by exact session and `message.id`, keeps Codex cumulative,
+last-turn, and response-joinable records separate, and reports Cursor usage as
+`not-recorded`. It never treats a missing counter as zero or converts tokens to
+money.
 
 ## Repository parser support
 
 The repository now has tested opt-in activity readers for the three documented
 transcript surfaces. This implementation status does not strengthen or extend
 the native-format observations on these pages.
 
 | Runtime     | Tested activity support                                                                                                                                       |
diff --git a/documentation/docs/user-guide/skills/session-export-transcript.md b/documentation/docs/user-guide/skills/session-export-transcript.md
index 19dc3854..0ec81a09 100644
--- a/documentation/docs/user-guide/skills/session-export-transcript.md
+++ b/documentation/docs/user-guide/skills/session-export-transcript.md
@@ -75,16 +75,40 @@ Session Observer offsets, and `--all` does not change output filenames.
 
 The export activity budget is 64 MiB for the rendered report, with no
 invocation-count cap and a 2 KiB preview per value. The shared projection also
 reserves 256 bytes for late-call context, although a normal full-session export
 starts at zero and includes the call itself. Source and delivery ranges,
 locators, captured/delivered/displayed counts, omissions, coverage, and
 diagnostics remain explicit.
 
+The report keeps native tool names and adds typed skill evidence when the
+transcript supplies it. Claude Code attribution, structured `Skill`
+invocations, and names-only skill attachments stay distinct. Cursor `Read` and
+`ReadFile` calls can supply inferred `SKILL.md` file-load evidence from their
+structured `path`. Historical Codex transcripts can supply the inference only
+from the exact experimental `read_file.file_path` carrier; upstream removed the
+tool in March 2026, and it is absent from the recent local sample. Shell
+commands, aliases, and prose are never treated as skill loads. Source-wide skill
+names are labelled `captured-source` and participate in the report byte budget
+with explicit omission counts.
+
+The supported runtimes do not record a skill version. A timestamp-relevant
+installed-file or Git lookup is inferred context, can remain unknown, and is
+not proof of the revision that executed.
+
+Captured-source token metadata preserves the runtime's semantics rather than
+combining unlike counters. Claude Code repeats of one `message.id` are
+deduplicated within the exact native session, conflicts are diagnosed, and
+missing IDs remain uncertain. Codex cumulative, last-turn, and
+response-joinable records stay separate; counter decreases mark reset segments,
+and models are attached only through recorded turn evidence. Cursor usage is
+`not-recorded`, not zero. The report emits token fields without pricing or cost
+estimates and explicitly counts usage metadata omitted by its byte budget.
+
 Activity previews can contain commands, paths, identifiers, tool inputs, and
 tool outputs even though the conversation section remains sanitized. The
 exporter does not open Claude persisted-output sidecars, Cursor `agent-tools/`
 files, or Claude, Codex, or Cursor child transcripts. Schema v1 emits explicit
 `not-read` coverage for persisted-output references recorded by Claude and child
 IDs recorded by Claude or Codex. Cursor `agent-tools/` and child-transcript
 surfaces have no dedicated per-reference schema-v1 coverage entry. Extraction
 failure appears as `record-activity: not-read` with an
diff --git a/documentation/docs/user-guide/skills/session-observer.md b/documentation/docs/user-guide/skills/session-observer.md
index 4fb99abd..f8dcbcc1 100644
--- a/documentation/docs/user-guide/skills/session-observer.md
+++ b/documentation/docs/user-guide/skills/session-observer.md
@@ -66,16 +66,42 @@ Activity has a separate fixed budget from the conversation controls:
 | `catch-up` / `watch` | 32 KiB         | 80          | 2 KiB        | 256 bytes         |
 
 The report distinguishes captured-source, delivered-range, and displayed
 counts. Its omission counts, coverage, diagnostics, and source locators explain
 what was bounded or unavailable. A result whose call occurred before the
 delivered range can retain a small `outside-delivered-range` call context
 without replaying the call as new activity.
 
+Skill evidence is additive to the native tool name. Claude Code can record a
+top-level skill attribution or a structured `Skill` invocation; captured-source
+attachments separately distinguish available skill names from recorded invoked
+names. Cursor contributes inferred load evidence only when a recorded `Read` or
+`ReadFile` call has a structured `path` ending in `SKILL.md`. Historical Codex
+transcripts can contribute the same inference only through the exact
+experimental `read_file` function's structured `file_path`; upstream removed
+that native tool in March 2026, and it was absent from the recent local sample.
+Current shell reads, aliases, and prose mentions are not parsed. Captured-source
+skill metadata can describe records outside the delivered range and is labelled
+accordingly; the report counts any entries removed by its byte budget.
+
+None of these runtimes records the executed skill version. Looking up an
+installed file or Git revision relevant to the transcript timestamp is an
+inference, may be unavailable, and does not prove which revision executed.
+
+Token usage is also captured-source metadata. Claude Code usage is deduplicated
+by exact native session and `message.id`; conflicting repeats are diagnosed and
+missing IDs remain explicitly uncertain. Codex cumulative totals, last-turn
+usage, and response-joinable usage remain separate samples. Repeated snapshots
+collapse, decreases start a new segment instead of producing negative usage,
+and a model appears only when a native turn join supports it. Cursor reports
+usage as `not-recorded`, never zero. Reports contain token fields only and do
+not estimate price or cost. Usage samples and diagnostics participate in the
+activity byte budget with explicit omission counts.
+
 Claude Code and Codex conversation and activity come from one detailed read.
 Cursor uses one physical-frame scan. `review` is a stateless full snapshot and
 does not move the high-water mark unless `--mark-read` is also present.
 Catch-up and watch share the ordinary delivery checkpoint; activity has no
 separate cursor.
 
 For Cursor, stateful activity waits for terminal settlement. A later
 `turn_ended` can emit an `activityOnly: true` delta when the call was previously
diff --git a/src/shared/transcript/activity/claude-code.ts b/src/shared/transcript/activity/claude-code.ts
index 736cb13a..69bed121 100644
--- a/src/shared/transcript/activity/claude-code.ts
+++ b/src/shared/transcript/activity/claude-code.ts
@@ -5,21 +5,111 @@ import {
   isJsonObject,
   numberValue,
   outcomeFromStatus,
   recordLocator,
   stringValue,
 } from './types.js';
 import type {
   ActivityOutcome,
+  ActivitySkillEvidence,
   ActivitySource,
+  ActivitySourceSkill,
   ExtractedActivityEvent,
   ExtractedRecordActivity,
 } from './types.js';
 
+function nonEmptyString(value: unknown): string | undefined {
+  const text = stringValue(value)?.trim();
+  return text ? text : undefined;
+}
+
+function claudeSkillEvidence(
+  record: Record<string, unknown>,
+  nativeName?: string,
+  input?: unknown,
+): ActivitySkillEvidence[] | undefined {
+  const evidence: ActivitySkillEvidence[] = [];
+  const attributed = nonEmptyString(record.attributionSkill);
+  if (attributed) {
+    evidence.push({ kind: 'native-attribution', name: attributed });
+  }
+  if (nativeName === 'Skill') {
+    const structured = isJsonObject(input) ? input : undefined;
+    const name = structured
+      ? (nonEmptyString(structured.skill) ?? nonEmptyString(structured.name))
+      : undefined;
+    evidence.push({
+      kind: 'native-invocation',
+      ...(name === undefined ? {} : { name }),
+    });
+  }
+  return evidence.length === 0 ? undefined : evidence;
+}
+
+function claudeToolArguments(
+  nativeName: string | undefined,
+  input: unknown,
+): unknown {
+  if (nativeName !== 'Skill') return input;
+  if (!isJsonObject(input)) return undefined;
+  const skill = nonEmptyString(input.skill);
+  const name = nonEmptyString(input.name);
+  if (skill !== undefined) return { skill };
+  if (name !== undefined) return { name };
+  return undefined;
+}
+
+function claudeSourceSkills(
+  detailed: DetailedTranscriptRecord,
+): ActivitySourceSkill[] {
+  const { record } = detailed;
+  if (record.type !== 'attachment' || !isJsonObject(record.attachment)) {
+    return [];
+  }
+  const attachment = record.attachment;
+  const type = stringValue(attachment.type);
+  if (type === 'skill_listing' && Array.isArray(attachment.names)) {
+    return attachment.names.flatMap((candidate, index) => {
+      const name = nonEmptyString(candidate);
+      return name
+        ? [
+            {
+              scope: 'captured-source' as const,
+              evidence: 'available' as const,
+              name,
+              locator: recordLocator(detailed, `/attachment/names/${index}`),
+            },
+          ]
+        : [];
+    });
+  }
+  if (type === 'invoked_skills' && Array.isArray(attachment.skills)) {
+    return attachment.skills.flatMap((candidate, index) => {
+      const name = isJsonObject(candidate)
+        ? nonEmptyString(candidate.name)
+        : undefined;
+      return name
+        ? [
+            {
+              scope: 'captured-source' as const,
+              evidence: 'invoked' as const,
+              name,
+              locator: recordLocator(
+                detailed,
+                `/attachment/skills/${index}/name`,
+              ),
+            },
+          ]
+        : [];
+    });
+  }
+  return [];
+}
+
 function claudeResultOutcome(block: Record<string, unknown>): ActivityOutcome {
   if (block.is_error === true) return 'error';
   if (block.is_error === false) return 'success';
   return 'unknown';
 }
 
 function topLevelResultOutcome(toolUseResult: unknown): ActivityOutcome {
   if (!isJsonObject(toolUseResult)) return 'unknown';
@@ -196,54 +286,64 @@ export function extractClaudeRecord(
 ): ExtractedRecordActivity {
   const { record } = detailed;
   const events: ExtractedActivityEvent[] = [];
   const coverage: ExtractedRecordActivity['coverage'] = [];
   const message = isJsonObject(record.message) ? record.message : undefined;
   const content = message?.content;
   const provenance = claudeUserRecordProvenance(record);
   const systemActivity = claudeSystemActivity(source, detailed);
+  const sourceSkills = claudeSourceSkills(detailed);
 
   if (systemActivity) events.push(systemActivity);
 
   if (record.type === 'assistant') {
     const metadata = selectedClaudeMetadata(record);
     if (metadata) {
       const locator = recordLocator(detailed, '/message');
       events.push({
         eventKey: eventKey(source, locator),
         kind: 'metadata',
         nativeType: 'assistant-metadata',
         locator,
         outcome: 'unknown',
         metadata,
+        ...(claudeSkillEvidence(record) === undefined
+          ? {}
+          : { skillEvidence: claudeSkillEvidence(record) }),
       });
     }
   }
 
   if (Array.isArray(content)) {
     content.forEach((candidate, blockIndex) => {
       if (!isJsonObject(candidate)) return;
       const blockType = stringValue(candidate.type);
       const locator = recordLocator(detailed, `/message/content/${blockIndex}`);
 
       if (blockType === 'tool_use') {
         const nativeCallId = stringValue(candidate.id);
         const nativeName = stringValue(candidate.name);
+        const input = Object.hasOwn(candidate, 'input')
+          ? candidate.input
+          : undefined;
+        const argumentsValue = claudeToolArguments(nativeName, input);
+        const skillEvidence = claudeSkillEvidence(record, nativeName, input);
         events.push({
           eventKey: eventKey(source, locator),
           kind: 'call',
           nativeType: blockType,
           locator,
           outcome: 'pending',
           ...(nativeCallId === undefined ? {} : { nativeCallId }),
           ...(nativeName === undefined ? {} : { nativeName }),
-          ...(Object.hasOwn(candidate, 'input')
-            ? { arguments: candidate.input }
-            : {}),
+          ...(argumentsValue === undefined
+            ? {}
+            : { arguments: argumentsValue }),
+          ...(skillEvidence === undefined ? {} : { skillEvidence }),
         });
         return;
       }
 
       if (blockType === 'tool_result') {
         const nativeCallId = stringValue(candidate.tool_use_id);
         const result = Object.hasOwn(candidate, 'content')
           ? { content: candidate.content }
@@ -287,10 +387,10 @@ export function extractClaudeRecord(
       kind: 'notification',
       nativeType: 'task-notification',
       locator,
       outcome: 'unknown',
       origin: provenance,
     });
   }
 
-  return { events, coverage, diagnostics: [] };
+  return { events, coverage, diagnostics: [], sourceSkills };
 }
diff --git a/src/shared/transcript/activity/codex.ts b/src/shared/transcript/activity/codex.ts
index 6be8dbae..ee84e88e 100644
--- a/src/shared/transcript/activity/codex.ts
+++ b/src/shared/transcript/activity/codex.ts
@@ -1,10 +1,11 @@
 import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
 import { decodeCodexLifecycleRecord } from '../terminal-events.js';
+import { structuredSkillFileReadEvidence } from './skill-evidence.js';
 import {
   eventKey,
   isJsonObject,
   numberValue,
   outcomeFromStatus,
   recordLocator,
   stringValue,
 } from './types.js';
@@ -233,16 +234,21 @@ function responseItemActivity(
   const nativeType = stringValue(payload.type);
   const locator = recordLocator(detailed, '/payload');
   if (nativeType === 'function_call' || nativeType === 'custom_tool_call') {
     const nativeCallId = stringValue(payload.call_id);
     const nativeId = stringValue(payload.id);
     const nativeName = stringValue(payload.name);
     const nativeStatus = stringValue(payload.status);
     const argumentEvidence = codexCallArguments(nativeType, payload, locator);
+    const skillEvidence = structuredSkillFileReadEvidence(
+      'codex',
+      nativeName,
+      argumentEvidence.fields.arguments,
+    );
     return {
       events: [
         {
           eventKey: eventKey(source, locator),
           kind: 'call',
           nativeType,
           locator,
           // custom_tool_call.status is a constant carrier value, not outcome.
@@ -250,16 +256,19 @@ function responseItemActivity(
           ...(nativeId === undefined ? {} : { nativeId }),
           ...(nativeCallId === undefined ? {} : { nativeCallId }),
           ...(nativeName === undefined ? {} : { nativeName }),
           ...(nativeStatus === undefined ? {} : { nativeStatus }),
           ...(Object.hasOwn(payload, 'namespace')
             ? { metadata: { namespace: payload.namespace } }
             : {}),
           ...argumentEvidence.fields,
+          ...(skillEvidence === undefined
+            ? {}
+            : { skillEvidence: [skillEvidence] }),
         },
       ],
       coverage: [],
       diagnostics: argumentEvidence.diagnostics,
     };
   }
 
   if (
diff --git a/src/shared/transcript/activity/cursor.test.ts b/src/shared/transcript/activity/cursor.test.ts
index 1e6e252e..3240d412 100644
--- a/src/shared/transcript/activity/cursor.test.ts
+++ b/src/shared/transcript/activity/cursor.test.ts
@@ -90,16 +90,66 @@ afterEach(async () => {
   await Promise.all(
     temporaryDirectories
       .splice(0)
       .map((directory) => rm(directory, { recursive: true, force: true })),
   );
 });
 
 describe('extractCursorActivity', () => {
+  it('infers skill loads from direct read tools without parsing shell commands', async () => {
+    const transcriptPath = await temporaryTranscript(
+      [
+        JSON.stringify({
+          role: 'assistant',
+          message: {
+            content: [
+              {
+                type: 'tool_use',
+                name: 'ReadFile',
+                input: { path: '/fixture/skills/one/SKILL.md' },
+              },
+              {
+                type: 'tool_use',
+                name: 'Shell',
+                input: { command: 'cat /fixture/skills/two/SKILL.md' },
+              },
+            ],
+          },
+        }),
+        JSON.stringify({ type: 'turn_ended', status: 'success' }),
+        '',
+      ].join('\n'),
+    );
+    const activity = await extract(transcriptPath, 'stateful-delivery');
+
+    expect(activity.events[0]).toMatchObject({
+      nativeName: 'ReadFile',
+      skillEvidence: [
+        {
+          kind: 'inferred-file-read',
+          name: 'one',
+          path: '/fixture/skills/one/SKILL.md',
+        },
+      ],
+    });
+    expect(activity.events[1]).not.toHaveProperty('skillEvidence');
+    expect(activity.coverage).toContainEqual({
+      dataClass: 'skills',
+      status: 'not-recorded',
+      captured: 0,
+    });
+    expect(activity.sourceMetadata?.usage).toEqual({
+      scope: 'captured-source',
+      availability: 'not-recorded',
+      samples: [],
+      diagnostics: [],
+    });
+  });
+
   it('extracts recorded calls with settled positional identity and no invented evidence', async () => {
     const activity = await extract(CAPTURED_FIXTURE, 'stateful-delivery');
 
     expect(activity.cursor.counts).toEqual({
       capturedCalls: 4,
       settledCalls: 4,
       pendingLifecycleCalls: 0,
       emittedCalls: 4,
diff --git a/src/shared/transcript/activity/cursor.ts b/src/shared/transcript/activity/cursor.ts
index e3fdd4c9..7a99e880 100644
--- a/src/shared/transcript/activity/cursor.ts
+++ b/src/shared/transcript/activity/cursor.ts
@@ -1,21 +1,23 @@
 import type {
   CursorTranscriptAnalysis,
   CursorTurnAnalysis,
 } from '../cursor-analysis.js';
 import type { CursorTranscriptScan } from '../cursor-frames.js';
+import { structuredSkillFileReadEvidence } from './skill-evidence.js';
 import { ACTIVITY_SCHEMA_VERSION } from './types.js';
 import type {
   ActivityCoverageEntry,
   ActivityEventLocator,
   ActivitySource,
   ExtractedActivity,
   ExtractedActivityEvent,
 } from './types.js';
+import { notRecordedUsage } from './usage.js';
 
 export type CursorActivityExtractionMode =
   | 'stateful-delivery'
   | 'stateless-snapshot';
 
 export interface ExtractCursorActivityInput {
   source: ActivitySource & { runtime: 'cursor' };
   scan: CursorTranscriptScan;
@@ -94,18 +96,23 @@ function eventKey(
 
 function callEvents(
   input: ExtractCursorActivityInput,
 ): ExtractedActivityEvent[] {
   return input.analysis.turns.flatMap((turn) => {
     const settled = isSettled(turn);
     if (input.mode === 'stateful-delivery' && !settled) return [];
 
-    return (turn.toolRecords ?? []).map(
-      (tool): ExtractedActivityEvent => ({
+    return (turn.toolRecords ?? []).map((tool): ExtractedActivityEvent => {
+      const skillEvidence = structuredSkillFileReadEvidence(
+        'cursor',
+        tool.nativeName,
+        tool.arguments,
+      );
+      return {
         eventKey: eventKey(
           turn,
           tool.sourceFrameIndex,
           tool.blockIndex,
           input.scan,
         ),
         kind: 'call',
         nativeType: tool.nativeType,
@@ -121,18 +128,21 @@ function callEvents(
         lifecycleAvailability: settled ? 'settled' : 'pending-lifecycle',
         turnOutcome: turn.lifecycle,
         ...(tool.nativeName === undefined
           ? {}
           : { nativeName: tool.nativeName }),
         ...(Object.hasOwn(tool, 'arguments')
           ? { arguments: tool.arguments }
           : {}),
-      }),
-    );
+        ...(skillEvidence === undefined
+          ? {}
+          : { skillEvidence: [skillEvidence] }),
+      };
+    });
   });
 }
 
 function lifecycleCounts(
   analysis: CursorTranscriptAnalysis,
   emittedCalls: number,
   mode: CursorActivityExtractionMode,
 ): CursorActivityCounts {
@@ -159,16 +169,21 @@ function coverage(
   mode: CursorActivityExtractionMode,
 ): ActivityCoverageEntry[] {
   const entries: ActivityCoverageEntry[] = [
     {
       dataClass: 'calls',
       status: 'available',
       captured: events.length,
     },
+    {
+      dataClass: 'skills',
+      status: 'not-recorded',
+      captured: 0,
+    },
     ...(events.length > 0 || mode === 'stateless-snapshot'
       ? [
           {
             dataClass: 'results' as const,
             status: 'not-recorded' as const,
             captured: 0,
           },
         ]
@@ -216,15 +231,20 @@ export function extractCursorActivity(
               physicalLine: input.scan.blockingFrame.frameIndex + 1,
               recordIndex: input.scan.blockingFrame.frameIndex,
               sourceFrameIndex: input.scan.blockingFrame.frameIndex,
               jsonPointer: '',
             },
           },
         ]
       : [],
+    sourceMetadata: {
+      scope: 'captured-source',
+      skills: [],
+      usage: notRecordedUsage(),
+    },
     cursor: {
       indexBase: input.scan.indexBase,
       mode: input.mode,
       counts,
     },
   };
 }
diff --git a/src/shared/transcript/activity/extract.test.ts b/src/shared/transcript/activity/extract.test.ts
index cd4f45ff..1aa3e6dd 100644
--- a/src/shared/transcript/activity/extract.test.ts
+++ b/src/shared/transcript/activity/extract.test.ts
@@ -38,30 +38,135 @@ function detailed(
     record,
     sourceCarrier: '{}',
     recordIndex,
     physicalLine: recordIndex + 1,
   };
 }
 
 describe('Claude Code activity extraction', () => {
+  it('keeps native skill attribution and names-only source attachments without bodies', () => {
+    const records = [
+      detailed(
+        {
+          type: 'assistant',
+          attributionSkill: 'session-observer',
+          message: {
+            content: [
+              {
+                type: 'tool_use',
+                id: 'skill-call',
+                name: 'Skill',
+                input: { skill: 'session-observer', body: 'private sentinel' },
+              },
+              { type: 'tool_use', id: 'read-call', name: 'Read', input: {} },
+            ],
+          },
+        },
+        0,
+      ),
+      detailed(
+        {
+          type: 'attachment',
+          attachment: {
+            type: 'skill_listing',
+            names: ['available-one', '', 42, 'available-two'],
+            content: 'private listing sentinel',
+            path: '/private/listing/path',
+          },
+        },
+        1,
+      ),
+      detailed(
+        {
+          type: 'attachment',
+          attachment: {
+            type: 'invoked_skills',
+            skills: [
+              { name: 'invoked-one', content: 'private invoked sentinel' },
+              { name: 42 },
+            ],
+          },
+        },
+        2,
+      ),
+    ];
+
+    const extracted = extractActivity({
+      source: CLAUDE_SOURCE,
+      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
+    });
+
+    expect(extracted.events[0]).toMatchObject({
+      nativeName: 'Skill',
+      skillEvidence: [
+        { kind: 'native-attribution', name: 'session-observer' },
+        { kind: 'native-invocation', name: 'session-observer' },
+      ],
+    });
+    expect(extracted.events[1]).toMatchObject({
+      nativeName: 'Read',
+      skillEvidence: [{ kind: 'native-attribution', name: 'session-observer' }],
+    });
+    expect(extracted.sourceMetadata).toMatchObject({
+      scope: 'captured-source',
+      skills: [
+        expect.objectContaining({
+          evidence: 'available',
+          name: 'available-one',
+          locator: expect.objectContaining({
+            jsonPointer: '/attachment/names/0',
+          }),
+        }),
+        expect.objectContaining({
+          evidence: 'available',
+          name: 'available-two',
+          locator: expect.objectContaining({
+            jsonPointer: '/attachment/names/3',
+          }),
+        }),
+        expect.objectContaining({
+          evidence: 'invoked',
+          name: 'invoked-one',
+          locator: expect.objectContaining({
+            jsonPointer: '/attachment/skills/0/name',
+          }),
+        }),
+      ],
+    });
+    const serialized = JSON.stringify(extracted.sourceMetadata);
+    expect(serialized).not.toContain('private');
+    expect(serialized).not.toContain('/private/listing/path');
+    expect(JSON.stringify(extracted)).not.toContain('private sentinel');
+    expect(extracted.coverage).toContainEqual({
+      dataClass: 'skills',
+      status: 'available',
+      captured: 3,
+    });
+  });
+
   it('extracts multiblock calls, result carriers, persisted output, and notifications', async () => {
     const read = await readRecordsDetailed(CLAUDE_SOURCE.transcriptPath);
     const extracted = extractActivity({
       source: CLAUDE_SOURCE,
       read,
     });
 
     expect(extracted.activitySchemaVersion).toBe(1);
     expect(extracted.source).toEqual(CLAUDE_SOURCE);
     expect(extracted.sourceSnapshot).toEqual({
       capturedAt: read.capturedAt,
       sourceBytes: read.sourceBytes,
     });
     expect(extracted.diagnostics).toEqual([]);
+    expect(extracted.coverage).toContainEqual({
+      dataClass: 'skills',
+      status: 'not-recorded',
+      captured: 0,
+    });
 
     const calls = extracted.events.filter((event) => event.kind === 'call');
     expect(calls.map((event) => event.nativeName)).toEqual([
       'Read',
       'Bash',
       'mcp__fixture__lookup',
     ]);
     expect(calls.map((event) => event.locator)).toEqual([
@@ -335,16 +440,112 @@ describe('Claude Code activity extraction', () => {
       },
     ]);
     expect(JSON.stringify(extracted)).not.toContain('private');
     expect(JSON.stringify(extracted)).not.toContain('preTokens');
   });
 });
 
 describe('Codex activity extraction', () => {
+  it('recognizes only the historical structured read_file carrier for Codex skill loads', () => {
+    const records = [
+      detailed(
+        {
+          type: 'response_item',
+          payload: {
+            type: 'function_call',
+            call_id: 'direct-read',
+            name: 'read_file',
+            arguments: JSON.stringify({
+              file_path: '/fixture/skills/session-observer/SKILL.md',
+            }),
+          },
+        },
+        0,
+      ),
+      detailed(
+        {
+          type: 'response_item',
+          payload: {
+            type: 'function_call',
+            call_id: 'shell-read',
+            name: 'exec_command',
+            arguments: JSON.stringify({
+              cmd: 'cat /fixture/skills/private-shell/SKILL.md',
+            }),
+          },
+        },
+        1,
+      ),
+      detailed(
+        {
+          type: 'response_item',
+          payload: {
+            type: 'function_call',
+            call_id: 'wrong-key',
+            name: 'read_file',
+            arguments: JSON.stringify({
+              path: '/fixture/skills/private-wrong-key/SKILL.md',
+            }),
+          },
+        },
+        2,
+      ),
+      detailed(
+        {
+          type: 'response_item',
+          payload: {
+            type: 'function_call',
+            call_id: 'unknown-name',
+            name: 'functions.read_file',
+            arguments: JSON.stringify({
+              file_path: '/fixture/skills/private-unknown/SKILL.md',
+            }),
+          },
+        },
+        3,
+      ),
+      detailed(
+        {
+          type: 'response_item',
+          payload: {
+            type: 'message',
+            role: 'assistant',
+            content: 'Mention /fixture/skills/private-prose/SKILL.md',
+          },
+        },
+        4,
+      ),
+    ];
+    const extracted = extractActivity({
+      source: CODEX_SOURCE,
+      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
+    });
+
+    expect(extracted.events[0]).toMatchObject({
+      nativeName: 'read_file',
+      skillEvidence: [
+        {
+          kind: 'inferred-file-read',
+          name: 'session-observer',
+          path: '/fixture/skills/session-observer/SKILL.md',
+        },
+      ],
+    });
+    expect(extracted.events[1]).not.toHaveProperty('skillEvidence');
+    expect(extracted.events[2]).not.toHaveProperty('skillEvidence');
+    expect(extracted.events[3]).not.toHaveProperty('skillEvidence');
+    expect(JSON.stringify(extracted)).not.toContain('private-prose');
+    expect(extracted.coverage).toContainEqual({
+      dataClass: 'skills',
+      status: 'not-recorded',
+      captured: 0,
+    });
+  });
+
   it('extracts native response carriers, standalone items, child ids, and metadata', async () => {
     const read = await readRecordsDetailed(CODEX_SOURCE.transcriptPath);
     const extracted = extractActivity({
       source: CODEX_SOURCE,
       read,
     });
 
     expect(extracted.activitySchemaVersion).toBe(1);
diff --git a/src/shared/transcript/activity/extract.ts b/src/shared/transcript/activity/extract.ts
index 6e502cdf..c7188caa 100644
--- a/src/shared/transcript/activity/extract.ts
+++ b/src/shared/transcript/activity/extract.ts
@@ -1,21 +1,23 @@
 import { extractClaudeRecord } from './claude-code.js';
 import { extractCodexRecord } from './codex.js';
 import { ACTIVITY_SCHEMA_VERSION } from './types.js';
 import type {
   ActivityCoverageEntry,
   ActivityDataClass,
   ActivityDiagnosticCode,
   ActivityLocator,
+  ActivitySourceSkill,
   ExtractActivityInput,
   ExtractedActivity,
   ExtractedActivityEvent,
   ExtractedRecordActivity,
 } from './types.js';
+import { extractUsageMetadata, notRecordedUsage } from './usage.js';
 
 function validateInput(input: ExtractActivityInput): void {
   const { source } = input;
   if (!source.sessionId || !source.nativeSessionId || !source.transcriptPath) {
     throw new Error('Activity extraction requires an exact selected source');
   }
   if (source.runtime !== 'claude-code' && source.runtime !== 'codex') {
     throw new Error(`Unsupported activity runtime: ${String(source.runtime)}`);
@@ -81,16 +83,18 @@ function extractionFailure(locator: ActivityLocator): ExtractedRecordActivity {
 
 export function extractActivity(
   input: ExtractActivityInput,
 ): ExtractedActivity {
   validateInput(input);
   const events: ExtractedActivity['events'] = [];
   const coverage: ExtractedActivity['coverage'] = [];
   const diagnostics: ExtractedActivity['diagnostics'] = [];
+  const sourceSkills: ActivitySourceSkill[] = [];
+  let usage = notRecordedUsage();
 
   for (const sourceDiagnostic of input.read.diagnostics) {
     const locator: ActivityLocator = {
       physicalLine: sourceDiagnostic.physicalLine,
       jsonPointer: '',
     };
     diagnostics.push({
       code: sourceDiagnosticCode(sourceDiagnostic.kind),
@@ -116,22 +120,45 @@ export function extractActivity(
         recordIndex: detailed.recordIndex,
         physicalLine: detailed.physicalLine,
         jsonPointer: '',
       });
     }
     events.push(...extracted.events);
     coverage.push(...extracted.coverage);
     diagnostics.push(...extracted.diagnostics);
+    sourceSkills.push(...(extracted.sourceSkills ?? []));
+  }
+
+  try {
+    usage = extractUsageMetadata(input.source, input.read.records);
+  } catch {
+    usage = notRecordedUsage();
   }
 
   return {
     activitySchemaVersion: ACTIVITY_SCHEMA_VERSION,
     source: input.source,
     sourceSnapshot: {
       capturedAt: input.read.capturedAt,
       sourceBytes: input.read.sourceBytes,
     },
     events,
-    coverage: [...baseCoverage(events), ...coverage],
     diagnostics,
+    sourceMetadata: {
+      scope: 'captured-source',
+      skills: sourceSkills,
+      usage,
+    },
+    coverage: [
+      ...baseCoverage(events),
+      ...coverage,
+      {
+        dataClass: 'skills',
+        status:
+          input.source.runtime === 'claude-code' && sourceSkills.length > 0
+            ? 'available'
+            : 'not-recorded',
+        captured: sourceSkills.length,
+      },
+    ],
   };
 }
diff --git a/src/shared/transcript/activity/project.test.ts b/src/shared/transcript/activity/project.test.ts
index 96e6fb2f..c634afe4 100644
--- a/src/shared/transcript/activity/project.test.ts
+++ b/src/shared/transcript/activity/project.test.ts
@@ -593,27 +593,92 @@ describe('activity projection budgets', () => {
       const serialized = renderActivityReport(first);
 
       expect(first.events).toEqual([]);
       expect(first.renderedBytes).toBe(Buffer.byteLength(serialized, 'utf8'));
       expect(first.renderedBytes).toBeLessThanOrEqual(first.limits.maxBytes);
       expect(first.omitted.diagnostics).toBeGreaterThan(0);
       expect(first.omitted.coverageEntries).toBeGreaterThan(0);
       expect(first.diagnostics.length + first.omitted.diagnostics).toBe(1_000);
-      expect(first.coverage.length + first.omitted.coverageEntries).toBe(1_004);
+      expect(first.coverage.length + first.omitted.coverageEntries).toBe(1_005);
       expect(second.diagnostics).toEqual(first.diagnostics);
       expect(second.coverage).toEqual(first.coverage);
       expect(second.omitted).toEqual(first.omitted);
       expect(first.diagnostics.at(-1)?.locator.physicalLine).toBe(1_000);
       expect(serialized).not.toContain(privateSourceMarker);
     } finally {
       await rm(directory, { recursive: true, force: true });
     }
   });
 
+  it('labels captured-source skill metadata and budgets it independently of delivery range', () => {
+    const extracted = activity([]);
+    extracted.sourceMetadata = {
+      scope: 'captured-source',
+      skills: Array.from({ length: 1_000 }, (_, index) => ({
+        scope: 'captured-source' as const,
+        evidence:
+          index % 2 === 0 ? ('available' as const) : ('invoked' as const),
+        name: `fixture-skill-${index}-${'x'.repeat(32)}`,
+        locator: {
+          recordIndex: index,
+          physicalLine: index + 1,
+          jsonPointer: `/attachment/names/${index}`,
+        },
+      })),
+      usage: {
+        scope: 'captured-source',
+        availability: 'recorded',
+        samples: Array.from({ length: 1_000 }, (_, index) => ({
+          semantics: 'claude-message' as const,
+          messageId: `message-${index}`,
+          tokens: { input_tokens: index, output_tokens: index + 1 },
+          locator: {
+            recordIndex: index + 1_000,
+            physicalLine: index + 1_001,
+            jsonPointer: '/message/usage',
+          },
+        })),
+        diagnostics: Array.from({ length: 40 }, (_, index) => ({
+          code: 'USAGE_DEDUP_UNCERTAIN' as const,
+          locator: {
+            recordIndex: index + 2_000,
+            physicalLine: index + 2_001,
+            jsonPointer: '/message/usage',
+          },
+        })),
+      },
+    };
+    const report = projectActivity(extracted, {
+      mode: 'watch',
+      renderFormat: 'compact-json',
+      deliveryRange: {
+        indexBase: 'zero-based-decoded-record-index',
+        start: 0,
+        end: 0,
+      },
+    });
+
+    expect(report.sourceMetadata.scope).toBe('captured-source');
+    expect(
+      report.sourceMetadata.skills.length + report.omitted.sourceSkills,
+    ).toBe(1_000);
+    expect(report.omitted.sourceSkills).toBeGreaterThan(0);
+    expect(
+      (report.sourceMetadata.usage?.samples.length ?? 0) +
+        report.omitted.usageSamples,
+    ).toBe(1_000);
+    expect(
+      (report.sourceMetadata.usage?.diagnostics.length ?? 0) +
+        report.omitted.usageDiagnostics,
+    ).toBe(40);
+    expect(report.omitted.usageSamples).toBeGreaterThan(0);
+    expect(report.renderedBytes).toBeLessThanOrEqual(report.limits.maxBytes);
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
index 4db1cdd1..2c31324d 100644
--- a/src/shared/transcript/activity/project.ts
+++ b/src/shared/transcript/activity/project.ts
@@ -8,16 +8,18 @@ import type {
   ActivityCoverageEntry,
   ActivityDeliveryRange,
   ActivityDiagnostic,
   ActivityPreview,
   ActivityProjectionLimits,
   ActivityProjectionMode,
   ActivityReport,
   ActivityScopedCounts,
+  ActivitySourceSkill,
+  ActivityUsageMetadata,
   CorrelatedActivity,
   CorrelatedActivityEvent,
   ProjectActivityOptions,
   ProjectedActivityEvent,
 } from './types.js';
 
 const KIB = 1024;
 const MIB = 1024 * KIB;
@@ -60,25 +62,35 @@ interface EvidenceGroup {
   recency: number;
 }
 
 interface OmissionReasons {
   invocationLimitGroups: number;
   byteLimitGroups: number;
   coverageEntries: number;
   diagnostics: number;
+  sourceSkills: number;
+  usageSamples: number;
+  usageDiagnostics: number;
 }
 
 interface ReportMetadata {
   coverage: ActivityCoverageEntry[];
   diagnostics: ActivityDiagnostic[];
+  sourceSkills: ActivitySourceSkill[];
+  usage: ActivityUsageMetadata;
 }
 
 interface MetadataCandidate {
-  kind: keyof ReportMetadata;
+  kind:
+    | 'coverage'
+    | 'diagnostics'
+    | 'sourceSkills'
+    | 'usageSamples'
+    | 'usageDiagnostics';
   index: number;
   locator: ActivityCoverageEntry['locator'];
 }
 
 function inRange(
   event: CorrelatedActivityEvent,
   range: ActivityDeliveryRange,
 ): boolean {
@@ -240,16 +252,23 @@ function deliveredMetadata(
   };
   return {
     coverage: activity.coverage.filter((entry) =>
       locatorInRange(entry.locator),
     ),
     diagnostics: activity.diagnostics.filter((entry) =>
       locatorInRange(entry.locator),
     ),
+    sourceSkills: activity.sourceMetadata?.skills ?? [],
+    usage: activity.sourceMetadata?.usage ?? {
+      scope: 'captured-source',
+      availability: 'not-recorded',
+      samples: [],
+      diagnostics: [],
+    },
   };
 }
 
 function compareMetadataPriority(
   left: MetadataCandidate,
   right: MetadataCandidate,
 ): number {
   return (
@@ -275,32 +294,83 @@ function retainMetadata(
     ),
     ...metadata.diagnostics.map(
       (entry, index): MetadataCandidate => ({
         kind: 'diagnostics',
         index,
         locator: entry.locator,
       }),
     ),
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
   ].toSorted(compareMetadataPriority);
   const retainedCoverage = new Set<number>();
   const retainedDiagnostics = new Set<number>();
+  const retainedSourceSkills = new Set<number>();
+  const retainedUsageSamples = new Set<number>();
+  const retainedUsageDiagnostics = new Set<number>();
   for (const candidate of priority.slice(0, retainedCount)) {
-    (candidate.kind === 'coverage'
-      ? retainedCoverage
-      : retainedDiagnostics
-    ).add(candidate.index);
+    let target = retainedUsageDiagnostics;
+    switch (candidate.kind) {
+      case 'coverage':
+        target = retainedCoverage;
+        break;
+      case 'diagnostics':
+        target = retainedDiagnostics;
+        break;
+      case 'sourceSkills':
+        target = retainedSourceSkills;
+        break;
+      case 'usageSamples':
+        target = retainedUsageSamples;
+        break;
+      case 'usageDiagnostics':
+        target = retainedUsageDiagnostics;
+        break;
+    }
+    target.add(candidate.index);
   }
   return {
     coverage: metadata.coverage.filter((_, index) =>
       retainedCoverage.has(index),
     ),
     diagnostics: metadata.diagnostics.filter((_, index) =>
       retainedDiagnostics.has(index),
     ),
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
   };
 }
 
 function projectEvent(
   event: CorrelatedActivityEvent,
   limits: ActivityProjectionLimits,
   suppressLinkedItemOutput: boolean,
 ): ProjectedActivityEvent {
@@ -356,16 +426,19 @@ function projectEvent(
       ? {}
       : { metadataPreview: preview(event.metadata, limits.previewBytes) }),
     ...(event.externalReference === undefined
       ? {}
       : { externalReference: event.externalReference }),
     ...(event.childReference === undefined
       ? {}
       : { childReference: event.childReference }),
+    ...(event.skillEvidence === undefined
+      ? {}
+      : { skillEvidence: event.skillEvidence }),
   };
 }
 
 function countEvents(
   scope: ActivityScopedCounts['scope'],
   events: readonly CorrelatedActivityEvent[],
 ): ActivityScopedCounts {
   return {
@@ -501,16 +574,21 @@ function buildReport(
       results: delivered.results - displayed.results,
       failures: delivered.failures - displayed.failures,
       ...reasons,
     },
     events,
     callContexts,
     coverage: metadata.coverage,
     diagnostics: metadata.diagnostics,
+    sourceMetadata: {
+      scope: 'captured-source',
+      skills: metadata.sourceSkills,
+      usage: metadata.usage,
+    },
   };
   return finalizeRenderedBytes(report);
 }
 
 export function projectActivityWithLimits(
   activity: CorrelatedActivity,
   options: ProjectActivityOptions,
   limits: ActivityProjectionLimits,
@@ -528,16 +606,19 @@ export function projectActivityWithLimits(
   const retained = new Set(groups.map((group) => group.key));
   for (const group of invocationOmitted) retained.delete(group.key);
   const metadata = deliveredMetadata(activity, options.deliveryRange);
   const initialReasons: OmissionReasons = {
     invocationLimitGroups: invocationOmitted.length,
     byteLimitGroups: 0,
     coverageEntries: 0,
     diagnostics: 0,
+    sourceSkills: 0,
+    usageSamples: 0,
+    usageDiagnostics: 0,
   };
   const initial = buildReport(
     activity,
     options,
     limits,
     groups,
     retained,
     metadata,
@@ -573,17 +654,22 @@ export function projectActivityWithLimits(
       best = candidate;
       high = removedCount - 1;
     } else {
       low = removedCount + 1;
     }
   }
   if (best) return best;
 
-  const metadataCount = metadata.coverage.length + metadata.diagnostics.length;
+  const metadataCount =
+    metadata.coverage.length +
+    metadata.diagnostics.length +
+    metadata.sourceSkills.length +
+    metadata.usage.samples.length +
+    metadata.usage.diagnostics.length;
   let metadataLow = 0;
   let metadataHigh = metadataCount;
   while (metadataLow <= metadataHigh) {
     const retainedCount = Math.floor((metadataLow + metadataHigh) / 2);
     const retainedMetadata = retainMetadata(metadata, retainedCount);
     const candidate = buildReport(
       activity,
       options,
@@ -593,16 +679,23 @@ export function projectActivityWithLimits(
       retainedMetadata,
       {
         ...initialReasons,
         byteLimitGroups: removable.length,
         coverageEntries:
           metadata.coverage.length - retainedMetadata.coverage.length,
         diagnostics:
           metadata.diagnostics.length - retainedMetadata.diagnostics.length,
+        sourceSkills:
+          metadata.sourceSkills.length - retainedMetadata.sourceSkills.length,
+        usageSamples:
+          metadata.usage.samples.length - retainedMetadata.usage.samples.length,
+        usageDiagnostics:
+          metadata.usage.diagnostics.length -
+          retainedMetadata.usage.diagnostics.length,
       },
     );
     if (candidate.renderedBytes <= limits.maxBytes) {
       best = candidate;
       metadataLow = retainedCount + 1;
     } else {
       metadataHigh = retainedCount - 1;
     }
diff --git a/src/shared/transcript/activity/render.ts b/src/shared/transcript/activity/render.ts
index 8b46825d..c2685270 100644
--- a/src/shared/transcript/activity/render.ts
+++ b/src/shared/transcript/activity/render.ts
@@ -85,16 +85,17 @@ function eventLines(event: ProjectedActivityEvent): string[] {
       nativeCallId: event.nativeCallId,
       nativeStatus: event.nativeStatus,
       origin: event.origin,
       turnId: event.turnId,
       lifecycleAvailability: event.lifecycleAvailability,
       turnOutcome: event.turnOutcome,
       externalReference: event.externalReference,
       childReference: event.childReference,
+      skillEvidence: event.skillEvidence,
     }).filter(([, value]) => value !== undefined),
   );
   return [
     `- ${event.kind} ${markdownData(identity)}; ${event.outcome}; ${event.ownership}; ${source}${relation}`,
     ...(Object.keys(evidence).length === 0
       ? []
       : [`  - native evidence: ${markdownData(evidence)}`]),
     ...previewLine('input', event.inputPreview),
@@ -125,16 +126,18 @@ export function renderActivityMarkdown(report: ActivityReport): string {
     `- Delivery range: [${report.deliveryRange.start}, ${report.deliveryRange.end}) ${report.deliveryRange.indexBase}`,
     `- Activity bytes: ${report.renderedBytes}/${report.limits.maxBytes}; preview cap: ${report.limits.previewBytes}; late context cap: ${report.limits.lateContextBytes}`,
     countLine(report.counts.capturedSource),
     countLine(report.counts.deliveredRange),
     countLine(report.counts.displayed),
     `- Omitted evidence: calls ${report.omitted.calls}; results ${report.omitted.results}; failures ${report.omitted.failures}`,
     `- Omitted groups: invocation limit ${report.omitted.invocationLimitGroups}; byte limit ${report.omitted.byteLimitGroups}`,
     `- Omitted metadata: coverage ${report.omitted.coverageEntries}; diagnostics ${report.omitted.diagnostics}`,
+    `- Source metadata: ${report.sourceMetadata.scope}; skills ${report.sourceMetadata.skills.length}; omitted skills ${report.omitted.sourceSkills}`,
+    `- Token usage: ${report.sourceMetadata.usage?.availability ?? 'not-recorded'}; samples ${report.sourceMetadata.usage?.samples.length ?? 0}; diagnostics ${report.sourceMetadata.usage?.diagnostics.length ?? 0}; omitted samples ${report.omitted.usageSamples}; omitted diagnostics ${report.omitted.usageDiagnostics}`,
     '',
     '### Events',
     '',
     ...(report.events.length === 0
       ? ['- None in the displayed range.']
       : report.events.flatMap(eventLines)),
   ];
 
@@ -168,10 +171,46 @@ export function renderActivityMarkdown(report: ActivityReport): string {
           nativeId: diagnostic.nativeId,
         }).filter(([, value]) => value !== undefined),
       );
       lines.push(
         `- ${diagnostic.code}; ${locatorText(diagnostic.locator)}${Object.keys(details).length === 0 ? '' : `; ${markdownData(details)}`}`,
       );
     }
   }
+  if (report.sourceMetadata.skills.length > 0) {
+    lines.push('', '### Captured-source skills', '');
+    for (const skill of report.sourceMetadata.skills) {
+      lines.push(
+        `- ${skill.evidence}: ${markdownData(skill.name)}; ${locatorText(skill.locator)}`,
+      );
+    }
+  }
+  const usage = report.sourceMetadata.usage;
+  if (usage && usage.samples.length > 0) {
+    lines.push('', '### Captured-source token usage', '');
+    for (const sample of usage.samples) {
+      const identity = Object.fromEntries(
+        Object.entries({
+          model: sample.model,
+          messageId: sample.messageId,
+          turnId: sample.turnId,
+          responseId: sample.responseId,
+          segment: sample.segment,
+          uncertainty: sample.uncertainty,
+        }).filter(([, value]) => value !== undefined),
+      );
+      lines.push(
+        `- ${sample.semantics}; ${locatorText(sample.locator)}${Object.keys(identity).length === 0 ? '' : `; ${markdownData(identity)}`}`,
+        `  - tokens: ${markdownData(sample.tokens)}`,
+      );
+    }
+  }
+  if (usage && usage.diagnostics.length > 0) {
+    lines.push('', '### Token usage diagnostics', '');
+    for (const diagnostic of usage.diagnostics) {
+      lines.push(
+        `- ${diagnostic.code}; ${locatorText(diagnostic.locator)}${diagnostic.messageId === undefined ? '' : `; message ${markdownData(diagnostic.messageId)}`}`,
+      );
+    }
+  }
   return `${lines.join('\n')}\n`;
 }
diff --git a/src/shared/transcript/activity/skill-evidence.ts b/src/shared/transcript/activity/skill-evidence.ts
new file mode 100644
index 00000000..d3ec8d82
--- /dev/null
+++ b/src/shared/transcript/activity/skill-evidence.ts
@@ -0,0 +1,35 @@
+import type { ActivitySkillEvidence } from './types.js';
+import { isJsonObject, stringValue } from './types.js';
+
+const CURSOR_DIRECT_READ_NAMES = new Set(['Read', 'ReadFile']);
+
+function skillNameFromPath(path: string): string | undefined {
+  const segments = path.split(/[\\/]/u);
+  if (segments.at(-1) !== 'SKILL.md') return undefined;
+  const parent = segments.at(-2)?.trim();
+  return parent ? parent : undefined;
+}
+
+export function structuredSkillFileReadEvidence(
+  runtime: 'codex' | 'cursor',
+  nativeName: string | undefined,
+  input: unknown,
+): ActivitySkillEvidence | undefined {
+  const eligible =
+    runtime === 'codex'
+      ? nativeName === 'read_file'
+      : nativeName !== undefined && CURSOR_DIRECT_READ_NAMES.has(nativeName);
+  if (!eligible) {
+    return undefined;
+  }
+  if (!isJsonObject(input)) return undefined;
+  const path = stringValue(
+    runtime === 'codex' ? input.file_path : input.path,
+  )?.trim();
+  if (!path || !skillNameFromPath(path)) return undefined;
+  return {
+    kind: 'inferred-file-read',
+    name: skillNameFromPath(path),
+    path,
+  };
+}
diff --git a/src/shared/transcript/activity/types.ts b/src/shared/transcript/activity/types.ts
index cb57b1c7..7a1273d0 100644
--- a/src/shared/transcript/activity/types.ts
+++ b/src/shared/transcript/activity/types.ts
@@ -83,16 +83,79 @@ export interface ActivityExternalReference {
 
 export interface ActivityChildReference {
   nativeId: string;
   nickname?: string;
   status?: string;
   trajectoryAvailability: 'not-read';
 }
 
+export type ActivitySkillEvidenceKind =
+  | 'native-attribution'
+  | 'native-invocation'
+  | 'inferred-file-read';
+
+export interface ActivitySkillEvidence {
+  kind: ActivitySkillEvidenceKind;
+  /** Recorded native skill name when the carrier provides one. */
+  name?: string;
+  /** Structured read-tool path. Never populated from shell commands or prose. */
+  path?: string;
+}
+
+export interface ActivitySourceSkill {
+  scope: 'captured-source';
+  evidence: 'available' | 'invoked';
+  name: string;
+  locator: ActivityEventLocator;
+}
+
+export type ActivityUsageSemantics =
+  | 'claude-message'
+  | 'codex-cumulative'
+  | 'codex-last-turn'
+  | 'codex-response';
+
+export interface ActivityTokenUsageSample {
+  semantics: ActivityUsageSemantics;
+  locator: ActivityEventLocator;
+  tokens: JsonObject;
+  model?: string;
+  messageId?: string;
+  turnId?: string;
+  responseId?: string;
+  segment?: number;
+  uncertainty?: 'missing-message-id';
+}
+
+export type ActivityUsageDiagnosticCode =
+  | 'USAGE_CONFLICT'
+  | 'USAGE_COUNTER_RESET'
+  | 'USAGE_DEDUP_UNCERTAIN'
+  | 'USAGE_SESSION_MISMATCH';
+
+export interface ActivityUsageDiagnostic {
+  code: ActivityUsageDiagnosticCode;
+  locator: ActivityEventLocator;
+  messageId?: string;
+}
+
+export interface ActivityUsageMetadata {
+  scope: 'captured-source';
+  availability: 'recorded' | 'not-recorded';
+  samples: ActivityTokenUsageSample[];
+  diagnostics: ActivityUsageDiagnostic[];
+}
+
+export interface ActivitySourceMetadata {
+  scope: 'captured-source';
+  skills: ActivitySourceSkill[];
+  usage?: ActivityUsageMetadata;
+}
+
 export interface ExtractedActivityEvent {
   eventKey: string;
   kind: ActivityEventKind;
   nativeType: string;
   locator: ActivityEventLocator;
   outcome: ActivityOutcome;
   nativeId?: string;
   nativeCallId?: string;
@@ -117,16 +180,17 @@ export interface ExtractedActivityEvent {
   /** Unmodified native result/output. Presentation budgets apply later. */
   result?: unknown;
   /** Supported native item carrier. Reasoning and instruction bodies are absent. */
   nativeValue?: JsonObject;
   /** Whitelisted metadata only; never an instruction/reasoning carrier. */
   metadata?: JsonObject;
   externalReference?: ActivityExternalReference;
   childReference?: ActivityChildReference;
+  skillEvidence?: ActivitySkillEvidence[];
 }
 
 export type ActivityDiagnosticCode =
   | 'ACTIVITY_EXTRACTION_ERROR'
   | 'ARGUMENT_PARSE_ERROR'
   | 'AMBIGUOUS_NATIVE_CORRELATION'
   | 'POSSIBLE_SOURCE_TRUNCATION'
   | 'SOURCE_MALFORMED_RECORD'
@@ -143,16 +207,17 @@ export interface ActivityDiagnostic {
 
 export type ActivityDataClass =
   | 'calls'
   | 'results'
   | 'items'
   | 'metadata'
   | 'persisted-output'
   | 'child-trajectory'
+  | 'skills'
   | 'record-activity';
 
 export interface ActivityCoverageEntry {
   dataClass: ActivityDataClass;
   status: ActivityCoverageStatus;
   captured: number;
   locator?: ActivityLocator;
 }
@@ -164,16 +229,17 @@ export interface ExtractActivityInput {
 
 export interface ExtractedActivity {
   activitySchemaVersion: typeof ACTIVITY_SCHEMA_VERSION;
   source: ActivitySource;
   sourceSnapshot: TranscriptSourceSnapshot;
   events: ExtractedActivityEvent[];
   coverage: ActivityCoverageEntry[];
   diagnostics: ActivityDiagnostic[];
+  sourceMetadata?: ActivitySourceMetadata;
 }
 
 export interface CorrelatedActivityEvent extends ExtractedActivityEvent {
   ownership: ActivityOwnership;
   category?: ActivityCategory;
   relatedCallKey?: string;
 }
 
@@ -254,16 +320,17 @@ export interface ProjectedActivityEvent {
     | 'unknown';
   inputPreview?: ActivityPreview;
   originalInputPreview?: ActivityPreview;
   outputPreview?: ActivityPreview;
   metadataPreview?: ActivityPreview;
   outputPreviewOmitted?: 'exact-linked-duplicate-carrier';
   externalReference?: ActivityExternalReference;
   childReference?: ActivityChildReference;
+  skillEvidence?: ActivitySkillEvidence[];
 }
 
 export interface ActivityCallContext {
   callKey: string;
   availability: 'outside-delivered-range';
   locator: ActivityEventLocator;
   nativeCallId?: string;
   nativeName?: string;
@@ -285,16 +352,19 @@ export interface ActivityScopedCounts {
 export interface ActivityOmissionCounts {
   calls: number;
   results: number;
   failures: number;
   invocationLimitGroups: number;
   byteLimitGroups: number;
   coverageEntries: number;
   diagnostics: number;
+  sourceSkills: number;
+  usageSamples: number;
+  usageDiagnostics: number;
 }
 
 export interface ActivityReport {
   activitySchemaVersion: typeof ACTIVITY_SCHEMA_VERSION;
   mode: ActivityProjectionMode;
   renderedFormat: ActivityRenderFormat;
   source: ActivitySource;
   sourceSnapshot: TranscriptSourceSnapshot;
@@ -306,22 +376,24 @@ export interface ActivityReport {
     deliveredRange: ActivityScopedCounts;
     displayed: ActivityScopedCounts;
   };
   omitted: ActivityOmissionCounts;
   events: ProjectedActivityEvent[];
   callContexts: ActivityCallContext[];
   coverage: ActivityCoverageEntry[];
   diagnostics: ActivityDiagnostic[];
+  sourceMetadata: ActivitySourceMetadata;
 }
 
 export interface ExtractedRecordActivity {
   events: ExtractedActivityEvent[];
   coverage: ActivityCoverageEntry[];
   diagnostics: ActivityDiagnostic[];
+  sourceSkills?: ActivitySourceSkill[];
 }
 
 export function isJsonObject(value: unknown): value is JsonObject {
   return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
 
 export function stringValue(value: unknown): string | undefined {
   return typeof value === 'string' ? value : undefined;
diff --git a/src/shared/transcript/activity/usage.test.ts b/src/shared/transcript/activity/usage.test.ts
new file mode 100644
index 00000000..b638ddac
--- /dev/null
+++ b/src/shared/transcript/activity/usage.test.ts
@@ -0,0 +1,243 @@
+import { describe, expect, it } from 'vitest';
+
+import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
+import { extractActivity } from './extract.js';
+import type { ActivitySource } from './types.js';
+
+const SNAPSHOT = {
+  capturedAt: '2026-09-20T00:00:00.000Z',
+  sourceBytes: 0,
+};
+
+function detailed(
+  record: JsonObject,
+  recordIndex: number,
+): DetailedTranscriptRecord {
+  return {
+    record,
+    sourceCarrier: '{}',
+    recordIndex,
+    physicalLine: recordIndex + 1,
+  };
+}
+
+function source(runtime: 'claude-code' | 'codex'): ActivitySource {
+  return {
+    runtime,
+    sessionId: 'native-session',
+    nativeSessionId: 'native-session',
+    transcriptPath: '/fixture/session.jsonl',
+  };
+}
+
+describe('captured-source token usage', () => {
+  it('deduplicates Claude message blocks and preserves conflicts and missing-id uncertainty', () => {
+    const usage = {
+      input_tokens: 10,
+      output_tokens: 4,
+      cache_creation: { ephemeral_5m_input_tokens: 2 },
+      service_tier: 'fixture-tier',
+      server_tool_use: { web_search_requests: 3 },
+    };
+    const records = [
+      detailed(
+        {
+          type: 'assistant',
+          sessionId: 'native-session',
+          message: { id: 'message-1', model: 'claude-fixture', usage },
+        },
+        0,
+      ),
+      detailed(
+        {
+          type: 'assistant',
+          sessionId: 'native-session',
+          message: { id: 'message-1', model: 'claude-fixture', usage },
+        },
+        1,
+      ),
+      detailed(
+        {
+          type: 'assistant',
+          sessionId: 'native-session',
+          message: {
+            id: 'message-1',
+            model: 'claude-fixture',
+            usage: { ...usage, output_tokens: 9 },
+          },
+        },
+        2,
+      ),
+      detailed(
+        {
+          type: 'assistant',
+          sessionId: 'native-session',
+          message: { usage: { input_tokens: 3, output_tokens: 1 } },
+        },
+        3,
+      ),
+      detailed(
+        {
+          type: 'assistant',
+          sessionId: 'native-session',
+          message: { usage: { input_tokens: 3, output_tokens: 1 } },
+        },
+        4,
+      ),
+      detailed(
+        {
+          type: 'assistant',
+          sessionId: 'other-session',
+          message: {
+            id: 'other-message',
+            model: 'wrong-session-model',
+            usage: { input_tokens: 999 },
+          },
+        },
+        5,
+      ),
+    ];
+
+    const extracted = extractActivity({
+      source: source('claude-code'),
+      read: { ...SNAPSHOT, records, diagnostics: [] },
+    });
+    const metadata = extracted.sourceMetadata?.usage;
+
+    expect(metadata?.availability).toBe('recorded');
+    expect(metadata?.samples).toHaveLength(3);
+    expect(metadata?.samples[0]).toMatchObject({
+      semantics: 'claude-message',
+      messageId: 'message-1',
+      model: 'claude-fixture',
+      tokens: {
+        input_tokens: 10,
+        output_tokens: 4,
+        cache_creation: { ephemeral_5m_input_tokens: 2 },
+      },
+    });
+    expect(metadata?.samples[0]?.tokens).not.toHaveProperty('service_tier');
+    expect(metadata?.samples[0]?.tokens).not.toHaveProperty('server_tool_use');
+    expect(metadata?.samples.slice(1)).toEqual([
+      expect.objectContaining({
+        uncertainty: 'missing-message-id',
+        tokens: { input_tokens: 3, output_tokens: 1 },
+      }),
+      expect.objectContaining({
+        uncertainty: 'missing-message-id',
+        tokens: { input_tokens: 3, output_tokens: 1 },
+      }),
+    ]);
+    expect(metadata?.diagnostics.map(({ code }) => code)).toEqual([
+      'USAGE_CONFLICT',
+      'USAGE_DEDUP_UNCERTAIN',
+      'USAGE_DEDUP_UNCERTAIN',
+      'USAGE_SESSION_MISMATCH',
+    ]);
+    expect(JSON.stringify(metadata)).not.toContain('wrong-session-model');
+    expect(JSON.stringify(metadata)).not.toMatch(/price|cost|currency/iu);
+  });
+
+  it('keeps Codex cumulative, last-turn, and response usage separate across resets', () => {
+    const tokenCount = (total: number, last: number): JsonObject => ({
+      type: 'event_msg',
+      payload: {
+        type: 'token_count',
+        info: {
+          total_token_usage: { input_tokens: total - 10, total_tokens: total },
+          last_token_usage: { input_tokens: last - 2, total_tokens: last },
+        },
+      },
+    });
+    const response = (
+      responseId: string,
+      turnId: string,
+      total: number,
+    ): JsonObject => ({
+      type: 'token_usage_record',
+      payload: {
+        session_id: 'native-session',
+        response_id: responseId,
+        turn_id: turnId,
+        usage: { input_tokens: total - 1, total_tokens: total },
+        turn_token_usage: { input_tokens: total - 2, total_tokens: total },
+        thread_token_usage: { input_tokens: total - 3, total_tokens: total },
+      },
+    });
+    const records = [
+      detailed(
+        {
+          type: 'turn_context',
+          payload: { turn_id: 'turn-1', model: 'gpt-fixture' },
+        },
+        0,
+      ),
+      detailed(tokenCount(100, 20), 1),
+      detailed(tokenCount(100, 20), 2),
+      detailed(tokenCount(80, 10), 3),
+      detailed(response('response-1', 'turn-1', 12), 4),
+      detailed(response('response-1', 'turn-1', 12), 5),
+      detailed(response('response-1', 'turn-1', 15), 6),
+      detailed(response('response-2', 'turn-unknown', 7), 7),
+      detailed(
+        {
+          type: 'token_usage_record',
+          payload: {
+            session_id: 'other-session',
+            response_id: 'wrong-session',
+            usage: { total_tokens: 999 },
+          },
+        },
+        8,
+      ),
+    ];
+
+    const extracted = extractActivity({
+      source: source('codex'),
+      read: { ...SNAPSHOT, records, diagnostics: [] },
+    });
+    const metadata = extracted.sourceMetadata?.usage;
+
+    expect(metadata?.samples.map(({ semantics }) => semantics)).toEqual([
+      'codex-cumulative',
+      'codex-last-turn',
+      'codex-cumulative',
+      'codex-last-turn',
+      'codex-response',
+      'codex-response',
+    ]);
+    expect(metadata?.samples.slice(0, 4).map(({ segment }) => segment)).toEqual(
+      [0, 0, 1, 1],
+    );
+    expect(metadata?.samples[4]).toMatchObject({
+      responseId: 'response-1',
+      turnId: 'turn-1',
+      model: 'gpt-fixture',
+      tokens: {
+        usage: { input_tokens: 11, total_tokens: 12 },
+        turn_token_usage: { input_tokens: 10, total_tokens: 12 },
+        thread_token_usage: { input_tokens: 9, total_tokens: 12 },
+      },
+    });
+    expect(metadata?.samples[5]).not.toHaveProperty('model');
+    expect(metadata?.diagnostics.map(({ code }) => code)).toEqual([
+      'USAGE_COUNTER_RESET',
+      'USAGE_CONFLICT',
+      'USAGE_SESSION_MISMATCH',
+    ]);
+    expect(JSON.stringify(metadata)).not.toMatch(/price|cost|currency/iu);
+  });
+
+  it('reports absence as not-recorded instead of zero', () => {
+    const extracted = extractActivity({
+      source: source('codex'),
+      read: { ...SNAPSHOT, records: [], diagnostics: [] },
+    });
+    expect(extracted.sourceMetadata?.usage).toEqual({
+      scope: 'captured-source',
+      availability: 'not-recorded',
+      samples: [],
+      diagnostics: [],
+    });
+  });
+});
diff --git a/src/shared/transcript/activity/usage.ts b/src/shared/transcript/activity/usage.ts
new file mode 100644
index 00000000..f27e990a
--- /dev/null
+++ b/src/shared/transcript/activity/usage.ts
@@ -0,0 +1,251 @@
+import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
+import type {
+  ActivitySource,
+  ActivityTokenUsageSample,
+  ActivityUsageDiagnostic,
+  ActivityUsageMetadata,
+} from './types.js';
+import {
+  isJsonObject,
+  numberValue,
+  recordLocator,
+  stringValue,
+} from './types.js';
+
+function stableValue(value: unknown): unknown {
+  if (Array.isArray(value)) return value.map(stableValue);
+  if (!isJsonObject(value)) return value;
+  return Object.fromEntries(
+    Object.entries(value)
+      .toSorted(([left], [right]) => left.localeCompare(right))
+      .map(([key, item]) => [key, stableValue(item)]),
+  );
+}
+
+function signature(value: unknown): string {
+  return JSON.stringify(stableValue(value));
+}
+
+function tokenFields(value: unknown): JsonObject | undefined {
+  if (!isJsonObject(value)) return undefined;
+  const entries: Array<[string, unknown]> = [];
+  for (const [key, item] of Object.entries(value)) {
+    if (
+      typeof item === 'number' &&
+      Number.isFinite(item) &&
+      /token/iu.test(key)
+    ) {
+      entries.push([key, item]);
+      continue;
+    }
+    const nested = tokenFields(item);
+    if (nested && Object.keys(nested).length > 0) entries.push([key, nested]);
+  }
+  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
+}
+
+function claudeRecordSessionId(record: JsonObject): string | undefined {
+  const message = isJsonObject(record.message) ? record.message : undefined;
+  return (
+    stringValue(record.sessionId) ??
+    stringValue(record.session_id) ??
+    stringValue(record.sessionID) ??
+    (message ? stringValue(message.sessionId) : undefined) ??
+    (message ? stringValue(message.session_id) : undefined)
+  );
+}
+
+function claudeUsage(
+  source: ActivitySource,
+  records: readonly DetailedTranscriptRecord[],
+): ActivityUsageMetadata {
+  const samples: ActivityTokenUsageSample[] = [];
+  const diagnostics: ActivityUsageDiagnostic[] = [];
+  const byMessage = new Map<
+    string,
+    { signature: string; sample: ActivityTokenUsageSample }
+  >();
+
+  for (const detailed of records) {
+    const { record } = detailed;
+    if (record.type !== 'assistant' || !isJsonObject(record.message)) continue;
+    const message = record.message;
+    const tokens = tokenFields(message.usage);
+    if (!tokens) continue;
+    const locator = recordLocator(detailed, '/message/usage');
+    const recordedSessionId = claudeRecordSessionId(record);
+    if (
+      recordedSessionId !== undefined &&
+      recordedSessionId !== source.nativeSessionId
+    ) {
+      diagnostics.push({ code: 'USAGE_SESSION_MISMATCH', locator });
+      continue;
+    }
+    const messageId = stringValue(message.id)?.trim() || undefined;
+    const model = stringValue(message.model)?.trim() || undefined;
+    const sample: ActivityTokenUsageSample = {
+      semantics: 'claude-message',
+      locator,
+      tokens,
+      ...(model === undefined ? {} : { model }),
+      ...(messageId === undefined
+        ? { uncertainty: 'missing-message-id' as const }
+        : { messageId }),
+    };
+    if (messageId === undefined) {
+      samples.push(sample);
+      diagnostics.push({ code: 'USAGE_DEDUP_UNCERTAIN', locator });
+      continue;
+    }
+    const key = `${source.nativeSessionId}:${messageId}`;
+    const sampleSignature = signature({ tokens, model });
+    const prior = byMessage.get(key);
+    if (!prior) {
+      byMessage.set(key, { signature: sampleSignature, sample });
+      samples.push(sample);
+      continue;
+    }
+    if (prior.signature !== sampleSignature) {
+      diagnostics.push({ code: 'USAGE_CONFLICT', locator, messageId });
+    }
+  }
+
+  return {
+    scope: 'captured-source',
+    availability: samples.length > 0 ? 'recorded' : 'not-recorded',
+    samples,
+    diagnostics,
+  };
+}
+
+function codexUsage(
+  source: ActivitySource,
+  records: readonly DetailedTranscriptRecord[],
+): ActivityUsageMetadata {
+  const samples: ActivityTokenUsageSample[] = [];
+  const diagnostics: ActivityUsageDiagnostic[] = [];
+  const turnModels = new Map<string, string>();
+  for (const { record } of records) {
+    if (record.type !== 'turn_context' || !isJsonObject(record.payload))
+      continue;
+    const turnId = stringValue(record.payload.turn_id);
+    const model = stringValue(record.payload.model);
+    if (turnId && model) turnModels.set(turnId, model);
+  }
+
+  let previousSnapshot: string | undefined;
+  let previousTotal: number | undefined;
+  let segment = 0;
+  const responses = new Map<string, string>();
+
+  for (const detailed of records) {
+    const { record } = detailed;
+    const payload = isJsonObject(record.payload) ? record.payload : undefined;
+    if (record.type === 'event_msg' && payload?.type === 'token_count') {
+      const info = isJsonObject(payload.info) ? payload.info : undefined;
+      if (!info) continue;
+      const total = tokenFields(info.total_token_usage);
+      const last = tokenFields(info.last_token_usage);
+      if (!total && !last) continue;
+      const snapshot = signature({ total, last });
+      if (snapshot === previousSnapshot) continue;
+      previousSnapshot = snapshot;
+      const totalTokens = total ? numberValue(total.total_tokens) : undefined;
+      if (
+        totalTokens !== undefined &&
+        previousTotal !== undefined &&
+        totalTokens < previousTotal
+      ) {
+        segment += 1;
+        diagnostics.push({
+          code: 'USAGE_COUNTER_RESET',
+          locator: recordLocator(detailed, '/payload/info/total_token_usage'),
+        });
+      }
+      if (totalTokens !== undefined) previousTotal = totalTokens;
+      if (total) {
+        samples.push({
+          semantics: 'codex-cumulative',
+          locator: recordLocator(detailed, '/payload/info/total_token_usage'),
+          tokens: total,
+          segment,
+        });
+      }
+      if (last) {
+        samples.push({
+          semantics: 'codex-last-turn',
+          locator: recordLocator(detailed, '/payload/info/last_token_usage'),
+          tokens: last,
+          segment,
+        });
+      }
+      continue;
+    }
+
+    if (record.type !== 'token_usage_record' || !payload) continue;
+    const recordedSessionId = stringValue(payload.session_id);
+    const locator = recordLocator(detailed, '/payload');
+    if (
+      recordedSessionId !== undefined &&
+      recordedSessionId !== source.nativeSessionId
+    ) {
+      diagnostics.push({ code: 'USAGE_SESSION_MISMATCH', locator });
+      continue;
+    }
+    const usage = tokenFields(payload.usage);
+    const turnUsage = tokenFields(payload.turn_token_usage);
+    const threadUsage = tokenFields(payload.thread_token_usage);
+    if (!usage && !turnUsage && !threadUsage) continue;
+    const tokens: JsonObject = {
+      ...(usage === undefined ? {} : { usage }),
+      ...(turnUsage === undefined ? {} : { turn_token_usage: turnUsage }),
+      ...(threadUsage === undefined ? {} : { thread_token_usage: threadUsage }),
+    };
+    const responseId = stringValue(payload.response_id)?.trim() || undefined;
+    const turnId = stringValue(payload.turn_id)?.trim() || undefined;
+    const sampleSignature = signature(tokens);
+    if (responseId !== undefined) {
+      const prior = responses.get(responseId);
+      if (prior === sampleSignature) continue;
+      if (prior !== undefined) {
+        diagnostics.push({ code: 'USAGE_CONFLICT', locator });
+        continue;
+      }
+      responses.set(responseId, sampleSignature);
+    }
+    const model = turnId ? turnModels.get(turnId) : undefined;
+    samples.push({
+      semantics: 'codex-response',
+      locator,
+      tokens,
+      ...(model === undefined ? {} : { model }),
+      ...(turnId === undefined ? {} : { turnId }),
+      ...(responseId === undefined ? {} : { responseId }),
+    });
+  }
+
+  return {
+    scope: 'captured-source',
+    availability: samples.length > 0 ? 'recorded' : 'not-recorded',
+    samples,
+    diagnostics,
+  };
+}
+
+export function extractUsageMetadata(
+  source: ActivitySource,
+  records: readonly DetailedTranscriptRecord[],
+): ActivityUsageMetadata {
+  return source.runtime === 'claude-code'
+    ? claudeUsage(source, records)
+    : codexUsage(source, records);
+}
+
+export function notRecordedUsage(): ActivityUsageMetadata {
+  return {
+    scope: 'captured-source',
+    availability: 'not-recorded',
+    samples: [],
+    diagnostics: [],
+  };
+}
diff --git a/src/skills/session-export-transcript/SKILL.md b/src/skills/session-export-transcript/SKILL.md
index 32d9ab42..f340ad59 100644
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
-  version: '2.0.25'
+  version: '2.0.27'
 ---
 
 # {{distribution.name}}
 
 Exports the **current** conversation (yours — Claude Code, Codex, or Cursor) to a
 sanitized Markdown transcript, named after the current git branch, written by
 default to `~/Downloads`. Tool calls, tool results, system/developer instructions,
 environment/AGENTS.md/skill payloads, subagent notifications, automatic-control
diff --git a/src/skills/session-fork-to-destination/SKILL.md b/src/skills/session-fork-to-destination/SKILL.md
index c1c579db..14d6ab92 100644
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
-  version: '0.2.39'
+  version: '0.2.41'
 ---
 
 # {{distribution.name}}
 
 > **Alpha.** This skill discovers and previews local sessions
 > read-only, then prepares instructions. It does not run a provider, authenticate,
 > create a fork, write a receipt, retry, reconcile a child ID, or control an IDE tab.
 
diff --git a/src/skills/session-observer-collab/SKILL.md b/src/skills/session-observer-collab/SKILL.md
index 232c8b62..5bda1478 100644
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
-  version: '1.0.62'
+  version: '1.0.64'
 ---
 
 # {{distribution.name}}
 
 Coordinate a user and two agent sessions through the canonical
 `{{skill:session-observer}}` skill. This skill defines collaboration protocol and wake
 boundaries; it does not reimplement transcript discovery, normalization,
 rendering, or offset storage.
diff --git a/src/skills/session-observer/SKILL.md b/src/skills/session-observer/SKILL.md
index 612bec5c..3cfb1359 100644
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
-  version: '1.0.74'
+  version: '1.0.76'
 ---
 
 # {{distribution.name}}
 
 Lets you (Claude Code, Codex, or Cursor) inspect another runtime's transcript for the current project, render a tool-free digest, and track runtime-specific read positions so follow-up checks surface only new content.
 
 ## Local runtime preflight
 
diff --git a/src/skills/session-observer/src/lib/watch.ts b/src/skills/session-observer/src/lib/watch.ts
index 659f29c6..996d9fcb 100644
--- a/src/skills/session-observer/src/lib/watch.ts
+++ b/src/skills/session-observer/src/lib/watch.ts
@@ -272,32 +272,60 @@ function digestNewRecords(digest: SessionDigest): number {
 function activitySourceSignature(target: WatchTarget): string {
   return `${target.signature.mtimeMs}:${target.signature.size}`;
 }
 
 function activityCoverageSignal(digest: SessionDigest): boolean {
   return Boolean(
     digest.activity?.diagnostics.length ||
     digest.activity?.coverage.some(
-      (entry) => entry.locator !== undefined || entry.status !== 'available',
+      (entry) =>
+        entry.dataClass !== 'skills' &&
+        (entry.locator !== undefined || entry.status !== 'available'),
     ),
   );
 }
 
 function activityAccountingSignal(digest: SessionDigest): boolean {
   const activity = digest.activity;
   if (!activity) return false;
   const delivered = activity.counts.deliveredRange;
+  const deliveredSourceSkill = activity.sourceMetadata.skills.some(
+    (skill) =>
+      skill.locator.recordIndex >= activity.deliveryRange.start &&
+      skill.locator.recordIndex < activity.deliveryRange.end,
+  );
+  const deliveredUsage = (activity.sourceMetadata.usage?.samples ?? []).some(
+    (sample) =>
+      sample.locator.recordIndex >= activity.deliveryRange.start &&
+      sample.locator.recordIndex < activity.deliveryRange.end,
+  );
+  const deliveredUsageDiagnostic = (
+    activity.sourceMetadata.usage?.diagnostics ?? []
+  ).some(
+    (diagnostic) =>
+      diagnostic.locator.recordIndex >= activity.deliveryRange.start &&
+      diagnostic.locator.recordIndex < activity.deliveryRange.end,
+  );
   return (
     delivered.calls > 0 ||
     delivered.countedInvocations > 0 ||
     delivered.results > 0 ||
     delivered.items > 0 ||
     delivered.failures > 0 ||
-    Object.values(activity.omitted).some((count) => count > 0)
+    deliveredSourceSkill ||
+    deliveredUsage ||
+    deliveredUsageDiagnostic ||
+    Object.entries(activity.omitted).some(
+      ([kind, count]) =>
+        kind !== 'sourceSkills' &&
+        kind !== 'usageSamples' &&
+        kind !== 'usageDiagnostics' &&
+        count > 0,
+    )
   );
 }
 
 function prepareActivityDelta(
   digest: SessionDigest,
   target: WatchTarget,
 ): {
   renderable: boolean;

```
