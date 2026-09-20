# Immutable phase review packet

Captured: 2026-09-20T21:59:27.662659+00:00
Repository: /Users/tstang/orca/workspaces/skills/session-fidelity
Base: a3f782c4da52ab0a02cdd0869904e41e6f6e32ca
Reviewed HEAD: c7b17f4455e20d2231c92caf210c252faefce822
Checkout status: clean

## Request

Review only the bounded p01 follow-up fix commit82ea5a1 and its generated/docs propagation, relative to basea3f782c4da52ab0a02cdd0869904e41e6f6e32ca. Prior full p01 review passed with M1/M2/L1; verify those fixes and new regressions without repeating unchanged phase code broadly.
M1: meaningful aborted/truncated assistant output and real user entries remain in watch deltas, terminal metadata stays separate; only provider API-error bodies suppressed, with explicit optionalapiErrorRecords accounting, no metadata double count including empty/malformed content; default non-terminal observe JSON/content unchanged.
M2: Claude prior same-session message blocks fold explicit abort evidence despite repeatedmessage.id and statusprecedence; future-only/orphan/cross-session pointers cannot join; API-error+abort coexist still suppresses secondarypointer.
L1: printed stoplabel and docs honestly describe eventCount as delta+terminal deliveries excludingheartbeat/control.
Expected verification supplied by Sol: watcher60/60, decoder/activity34/34, digest62/62, collab199/199; typecheck/buildfreshness/validate/version/scopedlintformat/docsbuild pass. Root inspected changes and verified exact one boundedfixcommit and clean tree. Signal/rearm mechanics unchanged, retained finalphase50-run stress proof remains applicable. Followup bookkeeping/archival/PRmetadata are contextonly. Do not edit files, invokeproviders, rerunstress or review unrelated immutablephasecode. Report substantive regressions or unresolved originalfindings, not speculative enhancements.
Response contract: externalpacket findings use anchor with exact packetSHA256, naming affected repositorypath/lines in evidence. No Critical/High means verdictpass (Medium/Low allowed); changes_requested requiresCritical/High. Be honest about checksnotrun.


## Scope adaptation

The base-branch selector captures entire before/after files including generated bundles and is capped at 2 MiB. This packet preserves the exact authored before/after Git diff (including deletions), all changed-file hashes, and immutable base/head references instead. Historical review artifacts and previously captured review packets are represented by hashes rather than recursively embedded; they remain available through the immutable revisions for context. Generated content is checked by build:check and version validation, with parity inspected where needed. The reviewer may read repository context and git-show either immutable revision but must not mutate any file or invoke providers. The whole checkout stays stable during review. Findings should use an anchor into THIS external packet with the exact packet SHA256 supplied by the wrapper; name the affected repository path/line in the claim/evidence. Never invent captured repository locations for files that are only context. This is a code-diff review carried as an external document, not an architecture-only plan review.

## Changed file manifest

```json
[
  {
    "path": ".oat/projects/shared/session-evidence-followups/implementation.md",
    "generated": false,
    "base": {
      "bytes": 11207,
      "sha256": "6c3e3136b9a8cdddc5a4db9c5bdce64ee01726568d41da0ca500a363fcd5ae41"
    },
    "head": {
      "bytes": 12548,
      "sha256": "8ff2d13953736949757ac13eeeaa1c244746582348de125edb2c5178df37880a"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/plan.md",
    "generated": false,
    "base": {
      "bytes": 28964,
      "sha256": "0c5134efbfd5c2e0a6506d19c839b9d3056cf0ff4e13f45712b2dfe21abfe45a"
    },
    "head": {
      "bytes": 29013,
      "sha256": "cd952709cb2df8f6ac2a219936ee701c080f2aeafd3776bfbfc9c62ad19056cf"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/archived/complexity-review.md",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 7460,
      "sha256": "b741f07abb9ab3d858e96c328d9c3b2eec71571e416684d237ac30eccbde2360"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/archived/p00-opus-review.md",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 15484,
      "sha256": "e18962b2a8f2846866f0384d8b791495b317dd621bcf8a4f097142bbc19b5c19"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/archived/p01-opus-review.md",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 19569,
      "sha256": "cc4449459a625232b36593e957ef3ce27a65b7ed26a5260efc71b0c97539a284"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/archived/plan-opus-h1-verification.md",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 10077,
      "sha256": "5c48516f64bcdebdb33889dff5fe3f6cba3e181da7115be9dcfdee11cbc71752"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/archived/plan-opus-review-1.md",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 13085,
      "sha256": "f92ec1103ed20eff6c798e1f0f322ed3d27a1480fd04969d9b1550374a7b7a58"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/archived/plan-review-disposition.md",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 7375,
      "sha256": "37a06f02caafef0025a452caa42a2617e92b5b8bad86f8a766bbdd4427df386a"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/complexity-review.md",
    "generated": false,
    "base": {
      "bytes": 7460,
      "sha256": "b741f07abb9ab3d858e96c328d9c3b2eec71571e416684d237ac30eccbde2360"
    },
    "head": null
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/p00-opus-review.md",
    "generated": false,
    "base": {
      "bytes": 15484,
      "sha256": "e18962b2a8f2846866f0384d8b791495b317dd621bcf8a4f097142bbc19b5c19"
    },
    "head": null
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/p01-opus-review.md",
    "generated": false,
    "base": {
      "bytes": 19569,
      "sha256": "cc4449459a625232b36593e957ef3ce27a65b7ed26a5260efc71b0c97539a284"
    },
    "head": null
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/plan-opus-h1-verification.md",
    "generated": false,
    "base": {
      "bytes": 10077,
      "sha256": "5c48516f64bcdebdb33889dff5fe3f6cba3e181da7115be9dcfdee11cbc71752"
    },
    "head": null
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/plan-opus-review-1.md",
    "generated": false,
    "base": {
      "bytes": 13085,
      "sha256": "f92ec1103ed20eff6c798e1f0f322ed3d27a1480fd04969d9b1550374a7b7a58"
    },
    "head": null
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/reviews/plan-review-disposition.md",
    "generated": false,
    "base": {
      "bytes": 7375,
      "sha256": "37a06f02caafef0025a452caa42a2617e92b5b8bad86f8a766bbdd4427df386a"
    },
    "head": null
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/state.md",
    "generated": false,
    "base": {
      "bytes": 6817,
      "sha256": "6296f0ced292b32f392f0069ad5fbfd1642027866c09018c2643378cb3440f30"
    },
    "head": {
      "bytes": 6718,
      "sha256": "16a53b71b00899fac96cf92bd84986e65814aa28008b4ab10366d305494b0b45"
    }
  },
  {
    "path": "CHANGELOG.md",
    "generated": false,
    "base": {
      "bytes": 40018,
      "sha256": "7ca5eb6b5c7df89517515e983b892a5f442fea995c304e896c8add94140a8aaa"
    },
    "head": {
      "bytes": 40545,
      "sha256": "043567ab467f18c5783c457e3b1831ef7a20da5fe9600bd73a2e3078df5f5ff9"
    }
  },
  {
    "path": "documentation/docs/user-guide/skills/session-observer.md",
    "generated": false,
    "base": {
      "bytes": 21032,
      "sha256": "dde88a74f8d1fee851d7e24bcf728ffbe7345c2e2edb67bd8177decbd3250249"
    },
    "head": {
      "bytes": 21570,
      "sha256": "284e8a16da2b0ebc393d36f214ff79890b2da879b43cb67208c8a45f89ea56d1"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 21438,
      "sha256": "375db7139a6c43f27a13582a7d52c5b8d0ff101628f6b3567a027033f465ae64"
    },
    "head": {
      "bytes": 21438,
      "sha256": "2dbfa07d209db11f0455888268315b7c28da10e9b712789942f54aa9f917f68c"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/claude-monitor.mjs",
    "generated": true,
    "base": {
      "bytes": 303750,
      "sha256": "2272fd19db665f34b0889b4a4fe58bdb88b209d91732a27016d4abe5b1706768"
    },
    "head": {
      "bytes": 303772,
      "sha256": "22ee080045cd9f8711e6066bbdfdda3df5404762fa96c705cc50ce13d121cbd6"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/hooks/codex-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 281965,
      "sha256": "f6cfe2a6175c0e5e425ea512b4f8d26d57f04804f194bf3ab45c74fcc29b73e0"
    },
    "head": {
      "bytes": 281987,
      "sha256": "966d6dd38e1d0a9023d3b171959f935079aac68505a081366f941260543f128f"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/hooks/cursor-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 224727,
      "sha256": "fc24909c2c5f4da60080d2c7949a8d1d1e3bb883e0cd41dbf378320ef5414b58"
    },
    "head": {
      "bytes": 224749,
      "sha256": "37e866df35913a4f4f690877ce489b7392a1532a976b4d2fce0c44d57c725e85"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/lib/selected-prefix.mjs",
    "generated": true,
    "base": {
      "bytes": 165909,
      "sha256": "bbb4db27c38dcfebc4ec0a774e0ff8e12663491b89aa5c178fcb937fc17d048e"
    },
    "head": {
      "bytes": 165931,
      "sha256": "062e716778d9289538d718df0e93b789ac2f56957caa2c762680c8615d4c98fe"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 48226,
      "sha256": "4a663be7bee714555469ea1904b4be09159a24a10f631cad4db6daf2776fc4a6"
    },
    "head": {
      "bytes": 48764,
      "sha256": "b7dc436e907b7e88f18eb565300c7dda09f99d5464203aec9f8f40e9a47f2e1d"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/digest.mjs",
    "generated": true,
    "base": {
      "bytes": 152923,
      "sha256": "71505d565f26b9a5824e6998b50a0de7d4a791e9bdde81b8cf0dd2d9e039e087"
    },
    "head": {
      "bytes": 153155,
      "sha256": "b0bf341b044f3e3f7cd77c22bfdb5518c1f1e122f51875b70ddced5f6360a563"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/observe.mjs",
    "generated": true,
    "base": {
      "bytes": 323366,
      "sha256": "d8283d1d387cdc9648150a5193f7abe9b575e9d648469395e8cb574dd643c3be"
    },
    "head": {
      "bytes": 323388,
      "sha256": "887638f20352a9c2ea39326760ffd24604d0c404f2d7b3a5020a9b97a3fe08eb"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/watch.mjs",
    "generated": true,
    "base": {
      "bytes": 397721,
      "sha256": "b8579dc9e8362e160d3ef8557e8e3cf3249f723d856fdf62602c8eb2b95be882"
    },
    "head": {
      "bytes": 397948,
      "sha256": "a827fdccc8cc5cb5fb096a34c03cac533225f927b716b21d6241166693b49027"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/session-observer.mjs",
    "generated": true,
    "base": {
      "bytes": 467208,
      "sha256": "d9ae4dcb62eb1d67ec21af59f690771cff6f5a751f2043168ffbe299a884e418"
    },
    "head": {
      "bytes": 467435,
      "sha256": "ec96baa8e72d6fff429c043593c63573588a06396bc91966627e2b0dedee0a0c"
    }
  },
  {
    "path": "plugins/session/skills/export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 11592,
      "sha256": "e88c5622c41b0bd804cb33c9380973b50070601d6f185a3bdef4ade5cc0fe3c5"
    },
    "head": {
      "bytes": 11592,
      "sha256": "9a63eed320a58b346056abd4fe86cd87206f519a2243e447029df5186155a05e"
    }
  },
  {
    "path": "plugins/session/skills/fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4412,
      "sha256": "03aae68dc261450a427e6caa33045368881ebec5bfdd8d73e9176fe20c6b4466"
    },
    "head": {
      "bytes": 4412,
      "sha256": "ee66456dc19659e5e5df240c1204419e4b0d4556729398b485ee68120564e32a"
    }
  },
  {
    "path": "skills/session-export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 11608,
      "sha256": "13617f63068faa23a20a1878f4e03b4dc5df646f78d545476622e70e35af3a17"
    },
    "head": {
      "bytes": 11608,
      "sha256": "67b8d0306df5c549566099a8acba65b8f8ed658b2127ecc245f845334e697c7a"
    }
  },
  {
    "path": "skills/session-fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4428,
      "sha256": "b0ef0c6c4f7f73ca3490dae88dd57b71e879db6dc2a923ba8f3db3cd0669c05a"
    },
    "head": {
      "bytes": 4428,
      "sha256": "e95d7e6b8389ac0f03ff0d1b043c62bb7128d490c9dc8ebd39742d4bcea45ab6"
    }
  },
  {
    "path": "skills/session-observer-collab/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 21502,
      "sha256": "8c6b4d2ed6666da8ded0fa82a363d5448073b592bbdc46b56454477c33774259"
    },
    "head": {
      "bytes": 21502,
      "sha256": "3b395cea9adff5ee220b6c31277d63cc50dadcf62232daf5abdf528a00b96b60"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/claude-monitor.mjs",
    "generated": true,
    "base": {
      "bytes": 303750,
      "sha256": "2272fd19db665f34b0889b4a4fe58bdb88b209d91732a27016d4abe5b1706768"
    },
    "head": {
      "bytes": 303772,
      "sha256": "22ee080045cd9f8711e6066bbdfdda3df5404762fa96c705cc50ce13d121cbd6"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/hooks/codex-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 281965,
      "sha256": "f6cfe2a6175c0e5e425ea512b4f8d26d57f04804f194bf3ab45c74fcc29b73e0"
    },
    "head": {
      "bytes": 281987,
      "sha256": "966d6dd38e1d0a9023d3b171959f935079aac68505a081366f941260543f128f"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/hooks/cursor-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 224727,
      "sha256": "fc24909c2c5f4da60080d2c7949a8d1d1e3bb883e0cd41dbf378320ef5414b58"
    },
    "head": {
      "bytes": 224749,
      "sha256": "37e866df35913a4f4f690877ce489b7392a1532a976b4d2fce0c44d57c725e85"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/lib/selected-prefix.mjs",
    "generated": true,
    "base": {
      "bytes": 165909,
      "sha256": "bbb4db27c38dcfebc4ec0a774e0ff8e12663491b89aa5c178fcb937fc17d048e"
    },
    "head": {
      "bytes": 165931,
      "sha256": "062e716778d9289538d718df0e93b789ac2f56957caa2c762680c8615d4c98fe"
    }
  },
  {
    "path": "skills/session-observer/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 48242,
      "sha256": "0d6f373ae04ea3204f7d9f5376559fcb0f96cf132184d42fee22cbdad775b07e"
    },
    "head": {
      "bytes": 48780,
      "sha256": "1efd373b27d2c5595d73efc8925a400c8446363f0e44d2571b665bf64ecb44da"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/digest.mjs",
    "generated": true,
    "base": {
      "bytes": 152923,
      "sha256": "71505d565f26b9a5824e6998b50a0de7d4a791e9bdde81b8cf0dd2d9e039e087"
    },
    "head": {
      "bytes": 153155,
      "sha256": "b0bf341b044f3e3f7cd77c22bfdb5518c1f1e122f51875b70ddced5f6360a563"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/observe.mjs",
    "generated": true,
    "base": {
      "bytes": 323366,
      "sha256": "d8283d1d387cdc9648150a5193f7abe9b575e9d648469395e8cb574dd643c3be"
    },
    "head": {
      "bytes": 323388,
      "sha256": "887638f20352a9c2ea39326760ffd24604d0c404f2d7b3a5020a9b97a3fe08eb"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/watch.mjs",
    "generated": true,
    "base": {
      "bytes": 397721,
      "sha256": "b8579dc9e8362e160d3ef8557e8e3cf3249f723d856fdf62602c8eb2b95be882"
    },
    "head": {
      "bytes": 397948,
      "sha256": "a827fdccc8cc5cb5fb096a34c03cac533225f927b716b21d6241166693b49027"
    }
  },
  {
    "path": "skills/session-observer/scripts/session-observer.mjs",
    "generated": true,
    "base": {
      "bytes": 467208,
      "sha256": "d9ae4dcb62eb1d67ec21af59f690771cff6f5a751f2043168ffbe299a884e418"
    },
    "head": {
      "bytes": 467435,
      "sha256": "ec96baa8e72d6fff429c043593c63573588a06396bc91966627e2b0dedee0a0c"
    }
  },
  {
    "path": "src/shared/transcript/terminal-events.test.ts",
    "generated": false,
    "base": {
      "bytes": 11101,
      "sha256": "d78f4acf49c89cb778f9c81878a4594772f8ca7fcf9e14d44f82b5793203bb85"
    },
    "head": {
      "bytes": 11973,
      "sha256": "15a49bcc6824b407f494c32caa8af8db88a28544339ad4522281b27af1374823"
    }
  },
  {
    "path": "src/shared/transcript/terminal-events.ts",
    "generated": false,
    "base": {
      "bytes": 10917,
      "sha256": "7461162abe9a9023d1663d0ece547133494bfbcfb8067d350cb9d344d3ba6cc8"
    },
    "head": {
      "bytes": 10531,
      "sha256": "91427845dff33cd1ac6d6e437a9370ff6352bb6c64a34139cf17ae7ac5206215"
    }
  },
  {
    "path": "src/skills/session-export-transcript/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 11604,
      "sha256": "ef01cd80c682e3c59a669b21f91ab05fbd09e8539ebe59228b0bdeb4d50a69ec"
    },
    "head": {
      "bytes": 11604,
      "sha256": "8dfbb47e7d1771d22ea1d8837f942c801bdfc5d8a7e925262cdfd52fdf2f5917"
    }
  },
  {
    "path": "src/skills/session-fork-to-destination/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 4422,
      "sha256": "47c4f53b042930483b11683c14ffe322dbd2a2847ec159abe80dbefa71dad124"
    },
    "head": {
      "bytes": 4422,
      "sha256": "eba04be5359a98a1fc012eb59492c531b9219cadbe873a2c3c5bf0ef09d67797"
    }
  },
  {
    "path": "src/skills/session-observer-collab/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 21541,
      "sha256": "0e13bbf6612592ed0ff093c2259632510127f28ed944d2e7e301f4b5438f8c21"
    },
    "head": {
      "bytes": 21541,
      "sha256": "87a9e2df43739db9205912203d4e53077d298479afa50dfc040698d4ffd645f9"
    }
  },
  {
    "path": "src/skills/session-observer/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 48247,
      "sha256": "5b0c74b728389db76fb57024932c364a1aefabd69c3d6248da0e1978109249ed"
    },
    "head": {
      "bytes": 48785,
      "sha256": "a3a0d8ae6fec8467566f801fcf4817b2b31c8cf7b593cf69209b99c1052a6d74"
    }
  },
  {
    "path": "src/skills/session-observer/src/digest.test.ts",
    "generated": false,
    "base": {
      "bytes": 81188,
      "sha256": "c819f37fe5c8078e52c4ed4df62caba32d155c7ab373c4d84d87ec7eef5679e9"
    },
    "head": {
      "bytes": 83145,
      "sha256": "57ec0ceadda8d8ddb2590ee143bd97d8e1f3e0fc1a185477254c6a52b2a340be"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/digest.ts",
    "generated": false,
    "base": {
      "bytes": 54964,
      "sha256": "7fc07e7460f3abe5097b525e0f6da4bc14067b68c7202accd47972ddeddff24c"
    },
    "head": {
      "bytes": 55535,
      "sha256": "f600bb23f78b70a826b4e5706c75a1def7be451d6f1ef0c01ed09307fbeb9176"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/types.ts",
    "generated": false,
    "base": {
      "bytes": 25808,
      "sha256": "807388f2cbac3a688ba1fbbda77042fab097c9a083649742dfdd4bcc13fec633"
    },
    "head": {
      "bytes": 25920,
      "sha256": "56c66bd86e1016ee08fb400b8bc95ccb30f6168b6220d24fe73eb04573d81a18"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/watch.ts",
    "generated": false,
    "base": {
      "bytes": 61518,
      "sha256": "4c15fce216d6efa95e0b9ad41ee8a1788004c0c8b163f5a09c8bfc63704cf4e6"
    },
    "head": {
      "bytes": 61595,
      "sha256": "2df608d068a5b8370cfe56650f73baa381a3524d7c5c9c7dd6e926459b1bc1c5"
    }
  },
  {
    "path": "src/skills/session-observer/src/watch.test.ts",
    "generated": false,
    "base": {
      "bytes": 164260,
      "sha256": "0b9b227f51965f5364d859207415012c5112f764279a8dd2357591fa895656df"
    },
    "head": {
      "bytes": 166217,
      "sha256": "75f7e88db0636784cf7adf9e497e3c8541216bd63e6bd744c0efa45e3c8b95d4"
    }
  }
]
```

## Authored before/after diff

```diff
diff --git a/.oat/projects/shared/session-evidence-followups/implementation.md b/.oat/projects/shared/session-evidence-followups/implementation.md
index 8a5f03e3..b411eb01 100644
--- a/.oat/projects/shared/session-evidence-followups/implementation.md
+++ b/.oat/projects/shared/session-evidence-followups/implementation.md
@@ -30,17 +30,17 @@ One branch/PR: backlog-review-2026-09-20. Native Sol phase implementation, user-
 ### p00 — completed
 
 Request `evidence-p00-20260920`; native `/root/p00_timeout` accepted and completed. Exact materialized role `oat-phase-implementer-gpt-5-6-sol-medium`; High policy, default-implementation class, medium effort selected for a bounded default change; candidates Sol medium/high. Runtime identity is configured invocation evidence, not independently observed.
 
 `Dispatch: scope=p00 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
 
 Base `f7298f35195ff305ec2d223f3873845444dc2317`; task commit `852be12cf67f5231f481dd97ce741e057d841937`; self-review passed. Root verified bounded files and clean worktree. Recovery attempts 0. No nested workers.
 
-Independent Consensus Review requested `claude:opus --effort high`, run `8c84e955-3f2e-4817-afd8-a7d08531875b`, passed with 0 Critical/High, one Medium and one Low. [Canonical review](reviews/p00-opus-review.md) is preserved unchanged. Consensus replaces the OAT-native reviewer contract by user selection; its own validated structured envelope supplies provenance, and no OAT reconnaissance claim is fabricated. Requested model/effort are configured controls; wrapper reports actual model/effort unobserved.
+Independent Consensus Review requested `claude:opus --effort high`, run `8c84e955-3f2e-4817-afd8-a7d08531875b`, passed with 0 Critical/High, one Medium and one Low. [Canonical review](reviews/archived/p00-opus-review.md) is preserved unchanged. Consensus replaces the OAT-native reviewer contract by user selection; its own validated structured envelope supplies provenance, and no OAT reconnaissance claim is fabricated. Requested model/effort are configured controls; wrapper reports actual model/effort unobserved.
 
 Disposition: M1 accepted as host-budget documentation guidance; same native handle continued as `evidence-p00-fix1-20260920`, commit `37f2832f387c1b5559a32c40396b1d92013b0fa9`, root inspected the exact docs-only diff. L1 declined: default dispatch assertion already fails meaningfully and duplicating the test adds no coverage. Reviewer question about why 900 seconds: explicit user-selected budget after observed 600-second cutoff, not a claimed latency percentile. No further review needed for this bounded nonblocking documentation clarification; final integration review still covers it.
 
 Validation: focused run.test.ts 25/25, type-check, build, build:check, scoped lint/format, skill-version validation from baseline, documentation production build and diff check passed. Docs follow-up repeated build freshness, scoped format, version validation, production docs build and self-review. Global installs remain unchanged until merge.
 
 ### p01 — implemented, independent review pending
 
 Request `evidence-p01-20260920`, native `/root/p01_watcher` accepted/completed as `oat-phase-implementer-gpt-5-6-sol-high`; High policy, hard-reasoning class, high effort for cross-runtime signal and checkpoint semantics; candidates Sol medium/high, high selected. No nested workers, recovery 0/10.
@@ -50,24 +50,26 @@ Request `evidence-p01-20260920`, native `/root/p01_watcher` accepted/completed a
 Base `73e1752b57e03878a908f506622142a5115b41e2`; p01-t01 `c1b68367b3cb143654f095e308b3f1cc81ba4788`; p01-t02 `83b36bf602c26a7309ed1e2b6e173ccf83a0798a`. Root verified exactly two in-scope task commits and clean worktree. Self-review passed. Observer 1.0.73, collab 1.0.61, export 2.0.24 and fork 0.2.38 include required transitive version closure.
 
 Verification: watcher 60/60; shared terminal/activity 32/32; full collaboration directory 199/199 across 13 files; typecheck, build/freshness, baseline skill versions, validate, scoped lint/format, diffcheck and docs production build (58 pages) passed. Claude watch integration checks pre-checkpoint pointer join, explicit-abort suppression and body omission. Subprocess audit: comparable cleanup tests wait for ownership/startup; max-runtime tests use virtual clocks or intentionally test timeout behavior, so no matching fixed-lifetime event-count race remains.
 
 Final-tree stress: [log](evidence/p01-final-stress.log), [temporary harness retained as evidence](evidence/p01-stress-harness.sh). Exactly 50 consecutive passes, 30 loaded iterations (11–40), clean process teardown. Root independently checked sequence/count and SHA256 `e3b9a6ad30da3f00d02c65b2c2d5db71daa7fcd6a3e348c1f67a8a7fa44b1e82`. Initial test-only log also passed 50/50, but final acceptance uses the final-tree evidence. Three fixing-PR validate successes still pending; no ticket closed.
 
 Review routing: exact Opus reviewer under High policy, `--effort high` user-selected Consensus route. The base-branch selector's 2 MiB whole-file snapshot cap is exceeded by duplicated generated bundles. Preserve authored before/after diff including deletions, immutable base/head and hashes of every changed file in a bounded external review packet; verify generated units with build:check and version validation. Keep entire checkout stable. This changes review transport only, not review scope or acceptance requirements; final review uses the same method if needed.
 
-### p01 review disposition — bounded fixes in progress
+### p01 review disposition — fixes implemented, verification review pending
 
-Independent Opus review run `446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4` passed with zero Critical/High, two Medium and one Low; [canonical result](reviews/p01-opus-review.md), [immutable reviewed packet](evidence/p01-review-packet.md), captured packet SHA256 `465a369170673c235b4f99923648479223b6db86c7600965bf96fa948d9ef8ec`. Requested `claude:opus --effort high`; actual model/effort unobserved by wrapper. No OAT-native reconnaissance claim is fabricated for this user-selected external review.
+Independent Opus review run `446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4` passed with zero Critical/High, two Medium and one Low; [canonical result](reviews/archived/p01-opus-review.md), [immutable reviewed packet](evidence/p01-review-packet.md), captured packet SHA256 `465a369170673c235b4f99923648479223b6db86c7600965bf96fa948d9ef8ec`. Requested `claude:opus --effort high`; actual model/effort unobserved by wrapper. No OAT-native reconnaissance claim is fabricated for this user-selected external review.
 
 M1 accepted: preserve meaningful aborted/truncated assistant output; suppress provider API-error bodies only with explicit filtered accounting and documented behavior. M2 accepted: native Claude message IDs span records; fold explicit-abort evidence across prior same-session blocks, with tests for non-final abort flags and later-only/orphan references. Root additionally observed that the existing map could join a future assistant record, contrary to the plan's prior-record requirement; fix in the same join scope. L1 accepted: stop/heartbeat documentation and printed label must describe delivered delta plus terminal events. Retry suffix whitespace question declined: strict observed grammar is intentional; no unsupported locale/whitespace inference is required. Cursor metadata frames already lack narrative content, so preserving meaningful Claude partial output resolves the apparent asymmetry.
 
 Same Sol handle receives bounded continuation `evidence-p01-fix1-20260920`, linked to `evidence-p01-20260920`; no replacement or target change. Review passed does not waive these accepted fixes or their verification. A bounded independent follow-up will verify the changes.
 
+Fix continuation completed as `82ea5a103497aa8210035a889e256f07cb5cafa9`, exactly one append-only commit from `a3f782c4da52ab0a02cdd0869904e41e6f6e32ca`. Root inspected the native join and digest accounting diff; clean worktree verified. M1/M2/L1 implemented, including root's future-only pointer and double-accounting checks. Observer1.0.74, collab1.0.62, export2.0.25 and fork0.2.39. Watcher60/60, shared decoder/activity34/34, digest62/62, collab199/199; types, build/freshness, validate, version checks, scoped lint/format and docs build passed. Signal/rearm mechanics unchanged; retained 50-run stress proof remains applicable. One nonblocking fix round, no implementation recovery attempts. Focused independent verification review pending.
+
 ## Task Records
 
 ### Task p00-t01: Give Consensus Review fifteen minutes by default
 
 **Status:** completed
 **Commit:** 852be12cf67f5231f481dd97ce741e057d841937
 **Outcome:** Provider dispatch defaults to 900 seconds with explicit internal overrides retained; host budget guidance added in 37f2832f.
 **Verification:** 25 focused tests, typecheck, build/freshness, version gate, docs build and independent Opus pass; details in p00 above.
@@ -102,16 +104,20 @@ Same Sol handle receives bounded continuation `evidence-p01-fix1-20260920`, link
 ## Test Results
 
 | Scope    | Command              | Result                                                 |
 | -------- | -------------------- | ------------------------------------------------------ |
 | Baseline | pnpm run build:check | Passed; /tmp/session-evidence-baseline-build-check.log |
 
 ## Final Summary (for PR/docs)
 
-p00 completed: Consensus Review defaults to 900 seconds with explicit internal overrides preserved. p01 implements reliable rearm testing and metadata-only unsuccessful terminal signals across Claude, Codex and Cursor. Four backlog tasks remain; no tickets closed and no PR exists yet.
+p00 completed: Consensus Review defaults to 900 seconds with explicit internal overrides preserved. p01 implements reliable rearm testing and metadata-only unsuccessful terminal signals across Claude, Codex and Cursor. Four backlog tasks remain; no tickets closed. Draft PR [#99](https://github.com/tkstang/skills/pull/99) is open; implementation and acceptance continue.
 
 ## References
 
 - [Plan](plan.md)
 - [Discovery](discovery.md)
-- [Review dispositions](reviews/plan-review-disposition.md)
-- [Complexity review](reviews/complexity-review.md)
+- [Review dispositions](reviews/archived/plan-review-disposition.md)
+- [Complexity review](reviews/archived/complexity-review.md)
+
+## Progress PR
+
+Draft PR #99 opened on branch backlog-review-2026-09-20 against main at remote head90086e6e. Pre-push validate/buildfreshness/types/version/internalflags passed. Conventional Commit title: `feat(session): add reliable activity evidence for retros`. Progress artifact is local `pr/progress-p01-2026-09-20.md`. Implementation remains in progress. CI at this fixing-PR head can qualify for watcher acceptance; no CI pass is yet claimed.
diff --git a/.oat/projects/shared/session-evidence-followups/plan.md b/.oat/projects/shared/session-evidence-followups/plan.md
index 21dfcfb0..587cb8f5 100644
--- a/.oat/projects/shared/session-evidence-followups/plan.md
+++ b/.oat/projects/shared/session-evidence-followups/plan.md
@@ -151,28 +151,28 @@ Root integrates and checks `pnpm run test`, `pnpm run type-check`, `pnpm run bui
 Open/push one Conventional Commit titled PR. Inspect remote reviews/checks; disposition all findings, implement valid fixes and re-review changed behavior. For watcher acceptance obtain three consecutive distinct successful CI workflow runs with the `validate` job on the fixing PR (via pushes or supported reruns without retrying away a failure). Record URLs, head and job results. A failure resets the consecutive success count and requires investigation. Preserve the 50-run local log with CPU-load evidence.
 
 Close each fully satisfied item via repo Backlog Lifecycle: status/updated, completed.md entry, move to archived, regenerate index and remove any consumed handoff. Update current-state/roadmap/priority-alignment for this batch. Do not close the watcher ticket before its CI proof. OAT implementation owns summary → documentation → PR closeout, honoring user authorization to deliver but not merge. Complete goal only after requirement-by-requirement proof and current PR mergeability/checks. Further wave requires separate selection.
 
 ## Reviews
 
 | Scope  | Type     | Status          | Date       | Artifact                      | Reviewed Head | Invocation | Gate Target |
 | ------ | -------- | --------------- | ---------- | ----------------------------- | ------------- | ---------- | ----------- |
-| p01 | code | fixes_added | 2026-09-20 | reviews/p01-opus-review.md | - | manual | - |
+| p01 | code | fixes_completed | 2026-09-20 | reviews/archived/p01-opus-review.md | - | manual | - |
 | p02    | code     | pending         | -          | -                             | -             | -          | -           |
 | final  | code     | pending         | -          | -                             | -             | -          | -           |
 | spec   | artifact | pending         | -          | -                             | -             | -          | -           |
 | design | artifact | pending         | -          | -                             | -             | -          | -           |
-| plan   | artifact | fixes_completed | 2026-09-20 | reviews/plan-opus-review-1.md | fd106e85      | manual     | claude:opus |
+| plan   | artifact | fixes_completed | 2026-09-20 | reviews/archived/plan-opus-review-1.md | fd106e85      | manual     | claude:opus |
 | p03    | code     | pending         | -          | -                             | -             | -          | -           |
 | p04    | code     | pending         | -          | -                             | -             | -          | -           |
-| plan | artifact | passed | 2026-09-20 | reviews/plan-opus-h1-verification.md | 6863c882 | manual | claude:opus |
-| p00 | code | passed | 2026-09-20 | reviews/p00-opus-review.md | - | manual | - |
+| plan | artifact | passed | 2026-09-20 | reviews/archived/plan-opus-h1-verification.md | 6863c882 | manual | claude:opus |
+| p00 | code | passed | 2026-09-20 | reviews/archived/p00-opus-review.md | - | manual | - |
 
-Spec/design rows are retained template history; quick mode uses discovery and this plan only. Full reviewed plan plus the clean bounded H1 verification establish readiness. [Complexity review](reviews/complexity-review.md) retains the minimum sufficient approach. The subsequently user-requested 600→900 timeout task is a narrow operational addition; its requirements are explicit above and it receives self-review and independent Opus code review, without repeating the unchanged six-ticket plan review.
+Spec/design rows are retained template history; quick mode uses discovery and this plan only. Full reviewed plan plus the clean bounded H1 verification establish readiness. [Complexity review](reviews/archived/complexity-review.md) retains the minimum sufficient approach. The subsequently user-requested 600→900 timeout task is a narrow operational addition; its requirements are explicit above and it receives self-review and independent Opus code review, without repeating the unchanged six-ticket plan review.
 
 ## Implementation Complete
 
 Phases 0–1 implemented; p01 review pending. Phase 0: 1 task; Phase 1: 2 tasks; Phase 2: 2 tasks; Phase 3: 1 task; Phase 4: 1 task. **Total: 7 tasks, 3 complete.** Final acceptance/delivery remains mandatory after product phases.
 
 ## References
 
 - [Discovery](discovery.md)
diff --git a/.oat/projects/shared/session-evidence-followups/state.md b/.oat/projects/shared/session-evidence-followups/state.md
index ecbc89ad..de6200b2 100644
--- a/.oat/projects/shared/session-evidence-followups/state.md
+++ b/.oat/projects/shared/session-evidence-followups/state.md
@@ -1,11 +1,11 @@
 ---
 oat_current_task: p02-t01
-oat_last_commit: 83b36bf602c26a7309ed1e2b6e173ccf83a0798a
+oat_last_commit: 82ea5a103497aa8210035a889e256f07cb5cafa9
 oat_blockers: []
 associated_issues:
   - { type: backlog, ref: 'BL-260919-stabilize-the-watcher-sigterm' }
   - { type: backlog, ref: 'BL-260919-surface-terminally' }
   - { type: backlog, ref: 'BL-260919-skill-attribution-in-session' }
   - { type: backlog, ref: 'BL-260919-token-and-usage-accounting' }
   - { type: backlog, ref: 'BL-260919-uncapped-structured-activity' }
   - { type: backlog, ref: 'BL-260919-session-retro-consume-activity' }
@@ -76,21 +76,21 @@ oat_workflow_origin: native # native | imported
 #   receive_event_identity: null
 #   receive_pre_head: null
 #   receive_commit: null
 #   receive_eligible: false
 #   receive_completed: false
 #   failure: null
 #   updated_at: '2026-07-18T00:00:00Z'
 oat_docs_updated: null # null | skipped | complete — documentation sync status
-oat_pr_status: null # null | ready | open | closed | merged — actual PR state for the current project
-oat_pr_url: null # null | string — tracked PR URL when a PR exists
+oat_pr_status: open
+oat_pr_url: https://github.com/tkstang/skills/pull/99
 oat_project_created: '2026-09-20T19:09:21.094Z' # ISO 8601 UTC timestamp — set once at project creation
 oat_project_completed: null # ISO 8601 UTC timestamp — set when project is completed/archived
-oat_project_state_updated: '2026-09-20T21:35:02.144308+00:00'
+oat_project_state_updated: '2026-09-20T21:59:24.828332+00:00'
 oat_dispatch_policy:
   mode: managed
   policy: high
   source: project-state
 oat_skill_gate_overrides:
   oat-project-quick-start: disabled
   oat-project-implement: disabled
 oat_generated: false
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d4dda1c8..f2bf5004 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -164,16 +164,24 @@
 - The `shared/transcript-core/` compatibility README and the
   `pnpm run sync:transcript-core` compatibility script. `pnpm run build` is the
   only generated-output command; the canonical source stays at
   `src/shared/transcript/runtimes.ts` (`session-export-transcript` 2.0.1,
   `session-fork-to-destination` 0.2.6).
 
 ### Fixed
 
+- `session-observer` 1.0.74 preserves meaningful Claude content alongside
+  aborted, truncated, and interruption terminal metadata while omitting and
+  explicitly accounting only provider API-error records. Claude interruption
+  joins now require a prior assistant and fold abort evidence across repeated
+  message blocks, and watch totals are labeled as all emitted events.
+  `session-observer-collab` 1.0.62, `session-export-transcript` 2.0.25, and
+  `session-fork-to-destination` 0.2.39 receive the shared runtime closure.
+
 - `session-observer` 1.0.71, `session-observer-collab` 1.0.59, `session-export-transcript` 2.0.23, and `session-fork-to-destination` 0.2.36 reconcile the merged Session Fidelity runtime closure with Agent Messaging's portable Codex and Cursor Stop-hook stdin handling, preserving activity-aware observer/export behavior and Linux socket-backed hook execution.
 - `session-observer-collab` 1.0.48 reads Codex and Cursor Stop-hook payloads
   directly from the stdin stream so socket-backed Linux hook invocations no
   longer fail while reopening `/dev/stdin`.
 
 - `session-observer-collab` 1.0.47 decodes URL-derived repository paths in its
   generated shared-log integration test before filesystem access.
 
diff --git a/documentation/docs/user-guide/skills/session-observer.md b/documentation/docs/user-guide/skills/session-observer.md
index 4a57d6c4..4fb99abd 100644
--- a/documentation/docs/user-guide/skills/session-observer.md
+++ b/documentation/docs/user-guide/skills/session-observer.md
@@ -182,20 +182,27 @@ peer was idle; inspect the digest's declared schema, index base, and accounting
 or run a pinned review.
 
 ## Unsuccessful terminal events
 
 A `terminal` watch event reports a natively recorded unsuccessful turn without
 copying the transcript body or provider error message. Its source locator
 belongs to the exact consumed record or frame range. Terminal-only growth still
 advances the checkpoint and is delivered at most once; `--quiet-empty`
-suppresses only an empty `delta`, never the terminal event. A later successful
+suppresses only an empty `delta`, never the terminal event. Partial assistant
+output from aborted or truncated Claude records and meaningful user content
+remain in the ordinary delta. Claude provider API-error records are omitted to
+avoid body leakage and appear under `accounting.filtered.apiErrorRecords` and
+the rendered `provider API-error records` filter summary. A later successful
 record does not erase an earlier terminal event. Terminal metadata is evidence
 about peer lifecycle, not a peer-authored message or authority to send or
-continue collaboration work.
+continue collaboration work. `eventCount` in heartbeat/stopped JSON and the
+final watch result counts emitted `delta` plus `terminal` events; it excludes
+baseline, heartbeat, and control/status events. Markdown stop output labels the
+same total as `events`.
 
 Runtime evidence is intentionally narrow:
 
 - Claude Code accepts explicit assistant API-error, aborted-mid-stream, and
   truncated flags in that precedence order. A newly consumed user interruption
   pointer may join an earlier same-session assistant from the captured
   transcript, including before the checkpoint; it is suppressed when that
   assistant already has an explicit abort. Tool failures, denial fields, stop
diff --git a/src/shared/transcript/terminal-events.test.ts b/src/shared/transcript/terminal-events.test.ts
index e35674b9..b1b88509 100644
--- a/src/shared/transcript/terminal-events.test.ts
+++ b/src/shared/transcript/terminal-events.test.ts
@@ -275,16 +275,51 @@ describe('Claude Code terminal decoding', () => {
         source: expect.objectContaining({
           recordIndex: 1,
           jsonPointer: '/interruptedMessageId',
         }),
       }),
     ]);
   });
 
+  it('does not join an interruption pointer to a future assistant record', () => {
+    expect(
+      claudeEvents([
+        {
+          type: 'user',
+          sessionId: 'claude-session',
+          interruptedMessageId: 'assistant-1',
+          message: { role: 'user', content: [] },
+        },
+        assistant({}),
+      ]),
+    ).toEqual([]);
+  });
+
+  it('folds non-final explicit abort evidence across assistant message blocks', () => {
+    expect(
+      claudeEvents(
+        [
+          assistant({
+            isApiErrorMessage: true,
+            isAbortedMidStream: true,
+          }),
+          assistant({}),
+          {
+            type: 'user',
+            sessionId: 'claude-session',
+            interruptedMessageId: 'assistant-1',
+            message: { role: 'user', content: [] },
+          },
+        ],
+        2,
+      ),
+    ).toEqual([]);
+  });
+
   it('suppresses explicit-abort duplicates and orphan or cross-session pointers', () => {
     const records = [
       assistant({ isAbortedMidStream: true }),
       {
         type: 'assistant',
         sessionId: 'other-session',
         message: { id: 'other-assistant', role: 'assistant', content: [] },
       },
diff --git a/src/shared/transcript/terminal-events.ts b/src/shared/transcript/terminal-events.ts
index 65161f95..97169d62 100644
--- a/src/shared/transcript/terminal-events.ts
+++ b/src/shared/transcript/terminal-events.ts
@@ -259,86 +259,77 @@ function claudeAssistantStatus(
 
 function claudeSessionId(record: JsonObject): string | undefined {
   return stringValue(record.sessionId);
 }
 
 function claudeTerminalEvents(
   source: ExactTerminalSource,
 ): UnsuccessfulTerminalEvent[] {
-  const assistants = new Map<
-    string,
-    {
-      detailed: DetailedTranscriptRecord;
-      status: UnsuccessfulTerminalStatus | null;
-    }
-  >();
+  const assistants = new Map<string, { hasExplicitAbort: boolean }>();
+  const events: UnsuccessfulTerminalEvent[] = [];
   for (const detailed of source.read.records) {
     const { record } = detailed;
     if (claudeSessionId(record) !== source.sessionId) continue;
     const message = isJsonObject(record.message) ? record.message : undefined;
-    if (message?.role !== 'assistant') continue;
-    const messageId = stringValue(message.id);
-    if (!messageId) continue;
-    assistants.set(messageId, {
-      detailed,
-      status: claudeAssistantStatus(record),
+    if (message?.role === 'assistant') {
+      const messageId = stringValue(message.id);
+      if (messageId) {
+        const prior = assistants.get(messageId);
+        assistants.set(messageId, {
+          hasExplicitAbort:
+            (prior?.hasExplicitAbort ?? false) ||
+            record.isAbortedMidStream === true,
+        });
+      }
+    }
+    if (
+      detailed.recordIndex < source.fromIndex ||
+      detailed.recordIndex >= source.nextIndex
+    ) {
+      continue;
+    }
+
+    const status = claudeAssistantStatus(record);
+    if (message?.role === 'assistant' && status !== null) {
+      const apiErrorStatus = record.apiErrorStatus;
+      events.push({
+        type: 'terminal',
+        runtime: 'claude-code',
+        sessionId: source.sessionId,
+        nativeSessionId: source.nativeSessionId,
+        nativeType: 'assistant',
+        status,
+        source: recordLocator(detailed, ''),
+        ...(status === 'api-error' &&
+        typeof apiErrorStatus === 'number' &&
+        Number.isFinite(apiErrorStatus)
+          ? { nativeErrorCode: apiErrorStatus }
+          : {}),
+      });
+      continue;
+    }
+
+    if (message?.role !== 'user') continue;
+    const interruptedMessageId = stringValue(record.interruptedMessageId);
+    if (!interruptedMessageId) continue;
+    const target = assistants.get(interruptedMessageId);
+    if (!target || target.hasExplicitAbort) continue;
+    events.push({
+      type: 'terminal',
+      runtime: 'claude-code',
+      sessionId: source.sessionId,
+      nativeSessionId: source.nativeSessionId,
+      nativeType: 'user-interruption',
+      status: 'interrupted',
+      source: recordLocator(detailed, '/interruptedMessageId'),
     });
   }
 
-  return source.read.records.flatMap(
-    (detailed): UnsuccessfulTerminalEvent[] => {
-      if (
-        detailed.recordIndex < source.fromIndex ||
-        detailed.recordIndex >= source.nextIndex
-      ) {
-        return [];
-      }
-      const { record } = detailed;
-      if (claudeSessionId(record) !== source.sessionId) return [];
-      const message = isJsonObject(record.message) ? record.message : undefined;
-      const status = claudeAssistantStatus(record);
-      if (message?.role === 'assistant' && status !== null) {
-        const apiErrorStatus = record.apiErrorStatus;
-        return [
-          {
-            type: 'terminal' as const,
-            runtime: 'claude-code' as const,
-            sessionId: source.sessionId,
-            nativeSessionId: source.nativeSessionId,
-            nativeType: 'assistant' as const,
-            status,
-            source: recordLocator(detailed, ''),
-            ...(status === 'api-error' &&
-            typeof apiErrorStatus === 'number' &&
-            Number.isFinite(apiErrorStatus)
-              ? { nativeErrorCode: apiErrorStatus }
-              : {}),
-          },
-        ];
-      }
-
-      if (message?.role !== 'user') return [];
-      const interruptedMessageId = stringValue(record.interruptedMessageId);
-      if (!interruptedMessageId) return [];
-      const target = assistants.get(interruptedMessageId);
-      if (!target || target.status === 'aborted-mid-stream') return [];
-      return [
-        {
-          type: 'terminal' as const,
-          runtime: 'claude-code' as const,
-          sessionId: source.sessionId,
-          nativeSessionId: source.nativeSessionId,
-          nativeType: 'user-interruption' as const,
-          status: 'interrupted' as const,
-          source: recordLocator(detailed, '/interruptedMessageId'),
-        },
-      ];
-    },
-  );
+  return events;
 }
 
 export function extractRecordedTerminalEvents(
   source: ExactTerminalSource,
 ): UnsuccessfulTerminalEvent[] {
   if (source.runtime === 'claude-code') return claudeTerminalEvents(source);
   return source.read.records.flatMap((detailed) => {
     if (
diff --git a/src/skills/session-export-transcript/SKILL.md b/src/skills/session-export-transcript/SKILL.md
index 3db955f1..32d9ab42 100644
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
-  version: '2.0.24'
+  version: '2.0.25'
 ---
 
 # {{distribution.name}}
 
 Exports the **current** conversation (yours — Claude Code, Codex, or Cursor) to a
 sanitized Markdown transcript, named after the current git branch, written by
 default to `~/Downloads`. Tool calls, tool results, system/developer instructions,
 environment/AGENTS.md/skill payloads, subagent notifications, automatic-control
diff --git a/src/skills/session-fork-to-destination/SKILL.md b/src/skills/session-fork-to-destination/SKILL.md
index f19a098a..c1c579db 100644
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
-  version: '0.2.38'
+  version: '0.2.39'
 ---
 
 # {{distribution.name}}
 
 > **Alpha.** This skill discovers and previews local sessions
 > read-only, then prepares instructions. It does not run a provider, authenticate,
 > create a fork, write a receipt, retry, reconcile a child ID, or control an IDE tab.
 
diff --git a/src/skills/session-observer-collab/SKILL.md b/src/skills/session-observer-collab/SKILL.md
index c9f79641..232c8b62 100644
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
-  version: '1.0.61'
+  version: '1.0.62'
 ---
 
 # {{distribution.name}}
 
 Coordinate a user and two agent sessions through the canonical
 `{{skill:session-observer}}` skill. This skill defines collaboration protocol and wake
 boundaries; it does not reimplement transcript discovery, normalization,
 rendering, or offset storage.
diff --git a/src/skills/session-observer/SKILL.md b/src/skills/session-observer/SKILL.md
index 93a4f2f3..612bec5c 100644
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
-  version: '1.0.73'
+  version: '1.0.74'
 ---
 
 # {{distribution.name}}
 
 Lets you (Claude Code, Codex, or Cursor) inspect another runtime's transcript for the current project, render a tool-free digest, and track runtime-specific read positions so follow-up checks surface only new content.
 
 ## Local runtime preflight
 
@@ -325,17 +325,17 @@ On exit 3 (ambiguousRuntime):
 **Watch mode operation:**
 
 Use `watch` when the user explicitly asks to keep monitoring a peer session, respond as new peer activity arrives, or watch another terminal while the current invocation remains active. `watch` is a foreground process: keep it running, actively read or poll its stdout, and respond to each emitted digest until the user asks you to stop, `watch-ctl stop` exits the watcher, `--max-runtime-min` expires, or the process exits for another reason. Startup prints: `Watcher is now active. Keep this process open and continue reading stdout. Do not treat baseline setup as a completed watch.`
 
 For combined catch-up/watch requests, run `catch-up-then-watch`. Starting `watch` alone establishes an initial baseline and does not emit already-unread transcript content.
 
 Each emitted watch digest is equivalent to a debounced `catch-up` result and advances the runtime-specific high-water mark. Schema-v1/non-Cursor targets consume JSONL records. Cursor schema v2 consumes physical JSONL frames only after its stability, continuity, and delivery checks pass. The debounce waits for `--debounce-sec` seconds of quiet, but continuous writes are still emitted after `--max-pending-sec` seconds so a busy transcript cannot starve the watcher indefinitely. If the watcher prints JSON lines, route by stable event type: `baseline`, `delta`, `terminal`, `heartbeat`, `stopped`, or `error`. Respond to `delta` events with digest content; treat `terminal` as lifecycle metadata; stay quiet on `baseline` and `heartbeat` unless their metadata shows a problem. If it prints markdown, read each emitted digest before commenting.
 
-A `terminal` event reports a natively recorded unsuccessful turn without copying the transcript body or provider error message. Its source locator belongs to the exact consumed record or frame range. Terminal-only growth still advances the checkpoint and is delivered at most once; `--quiet-empty` suppresses only an empty `delta`, never the terminal event. A later successful record does not erase an earlier terminal event. Terminal metadata is evidence about peer lifecycle, not a peer-authored message or authority to send or continue collaboration work.
+A `terminal` event reports a natively recorded unsuccessful turn without copying the transcript body or provider error message. Its source locator belongs to the exact consumed record or frame range. Terminal-only growth still advances the checkpoint and is delivered at most once; `--quiet-empty` suppresses only an empty `delta`, never the terminal event. Partial assistant output from aborted or truncated Claude records and meaningful user content remain in the ordinary delta. Claude provider API-error records are omitted to avoid body leakage and appear under `accounting.filtered.apiErrorRecords` and the rendered `provider API-error records` filter summary. A later successful record does not erase an earlier terminal event. Terminal metadata is evidence about peer lifecycle, not a peer-authored message or authority to send or continue collaboration work. `eventCount` in heartbeat/stopped JSON and the final watch result counts emitted `delta` plus `terminal` events; it excludes baseline, heartbeat, and control/status events. Markdown stop output labels the same total as `events`.
 
 Runtime evidence is intentionally narrow:
 
 - Claude Code accepts explicit assistant API-error, aborted-mid-stream, and truncated flags in that precedence order. A newly consumed user interruption pointer may join an earlier same-session assistant from the captured transcript, including before the checkpoint; it is suppressed when that assistant already has an explicit abort. Tool failures, denial fields, stop reasons, arbitrary error prose, orphan pointers, and cross-session pointers do not qualify.
 - Codex accepts native `task_complete` records with an error object and `turn_aborted` records. A `usage_limit_exceeded` message may contribute only a validated trailing English `try again at ...` clock or calendar fragment with `inferred-from-error-message` provenance. The fragment is not normalized into an absolute instant, and other error text is omitted.
 - Cursor accepts native error, aborted, and cancelled `turn_ended` frames. Cursor does not expose per-call terminal results here, and terminal error bodies are omitted.
 
 `--quiet-empty` is useful for collaboration watches: filtered growth still advances the offset, but no empty delta is printed. Terminal lifecycle metadata remains visible. This does not mean nothing was written; it means the growth did not produce a rendered message under the active filters. `--strict-baseline` protects a standalone `watch` from silently skipping a previously unread range. Without it, such a start emits one `baseline-gap` warning with the zero-based skipped range; with it, startup refuses and leaves the prior offset intact. `catch-up-then-watch` first renders unread backlog and therefore does not create a baseline gap.
diff --git a/src/skills/session-observer/src/digest.test.ts b/src/skills/session-observer/src/digest.test.ts
index de52cb35..42711628 100644
--- a/src/skills/session-observer/src/digest.test.ts
+++ b/src/skills/session-observer/src/digest.test.ts
@@ -1139,16 +1139,75 @@ describe('buildDigest', () => {
       expect(JSON.parse(renderJson(digest)).entries[0]).toMatchObject({
         origin: 'runtime-notification',
       });
     } finally {
       await rm(tmpDir, { recursive: true, force: true });
     }
   });
 
+  test('keeps default Claude API-error content but accounts watch-only omission once', async () => {
+    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-claude-api-error-'));
+    try {
+      const transcriptPath = join(tmpDir, 'api-error.jsonl');
+      await writeFile(
+        transcriptPath,
+        [
+          {
+            type: 'assistant',
+            sessionId: 'claude-api-error',
+            isApiErrorMessage: true,
+            message: {
+              id: 'api-error-with-body',
+              role: 'assistant',
+              content: 'private provider body',
+            },
+          },
+          {
+            type: 'assistant',
+            sessionId: 'claude-api-error',
+            isApiErrorMessage: true,
+            message: {
+              id: 'api-error-empty',
+              role: 'assistant',
+              content: [],
+            },
+          },
+        ]
+          .map((record) => JSON.stringify(record))
+          .join('\n') + '\n',
+      );
+
+      const defaultDigest = await buildDigest('claude-code', transcriptPath);
+      expect(defaultDigest.entries).toContainEqual(
+        expect.objectContaining({ text: 'private provider body' }),
+      );
+      expect(defaultDigest).not.toHaveProperty('terminalEvents');
+      expect(defaultDigest.accounting.filtered).not.toHaveProperty(
+        'apiErrorRecords',
+      );
+
+      const watchDigest = await buildDigest('claude-code', transcriptPath, {
+        includeTerminalEvents: true,
+      });
+      expect(watchDigest.entries).toEqual([]);
+      expect(watchDigest.terminalEvents).toHaveLength(2);
+      expect(watchDigest.accounting).toMatchObject({
+        raw: { count: 2 },
+        rendered: { count: 0 },
+        filtered: { apiErrorRecords: 2, metadataRecords: 0 },
+      });
+      expect(renderMarkdown(watchDigest)).toContain(
+        'provider API-error records: 2',
+      );
+    } finally {
+      await rm(tmpDir, { recursive: true, force: true });
+    }
+  });
+
   test('renders queued Claude input once across review and catch-up digests', async () => {
     for (const mode of ['review', 'catch-up'] as const) {
       const digest = await buildDigest('claude-code', queuedMidTurnClaude, {
         fromIndex: 0,
         mode,
       });
       const queuedEntries = digest.entries.filter(
         (entry: any) => entry.displayRole === 'queued-user',
diff --git a/src/skills/session-observer/src/lib/digest.ts b/src/skills/session-observer/src/lib/digest.ts
index b1b5e90f..1f5d89b8 100644
--- a/src/skills/session-observer/src/lib/digest.ts
+++ b/src/skills/session-observer/src/lib/digest.ts
@@ -301,16 +301,24 @@ function formatHeader(digest: Digest): string {
     if (filtered.toolCalls > 0)
       filterParts.push(`tool calls: ${filtered.toolCalls}`);
     if (filtered.toolResults > 0)
       filterParts.push(`tool results: ${filtered.toolResults}`);
     if (filtered.commandMessages > 0)
       filterParts.push(`command messages: ${filtered.commandMessages}`);
     if (filtered.bootstrapRecords > 0)
       filterParts.push(`bootstrap records: ${filtered.bootstrapRecords}`);
+    if (
+      'apiErrorRecords' in filtered &&
+      filtered.apiErrorRecords !== undefined &&
+      filtered.apiErrorRecords > 0
+    )
+      filterParts.push(
+        `provider API-error records: ${filtered.apiErrorRecords}`,
+      );
     if (filtered.metadataRecords > 0)
       filterParts.push(
         `metadata/non-message records: ${filtered.metadataRecords}`,
       );
     if (filtered.tailSliceEntries > 0)
       filterParts.push(`tail-sliced entries: ${filtered.tailSliceEntries}`);
     if (filterParts.length > 0) {
       lines.push(`**filtered out:** ${filterParts.join(' · ')}`);
@@ -1293,19 +1301,21 @@ export async function buildDigest(
           runtime,
           sessionId,
           nativeSessionId: identity?.nativeSessionId ?? sessionId,
           read: capturedRead,
           fromIndex: rawFromIndex,
           nextIndex: totalRecords,
         })
       : undefined;
-  const terminalRecordIndexes = new Set(
+  const apiErrorRecordIndexes = new Set(
     terminalEvents?.flatMap((event) =>
-      event.source.recordIndex === undefined ? [] : [event.source.recordIndex],
+      event.status === 'api-error' && event.source.recordIndex !== undefined
+        ? [event.source.recordIndex]
+        : [],
     ) ?? [],
   );
 
   // Normalize all records to entries. Keep an unfiltered view for accounting so
   // the digest can explain records consumed but omitted by default filters.
   const allEntriesWithToolsBeforeBootstrap = normalizeEntries(
     runtime,
     records,
@@ -1320,22 +1330,22 @@ export async function buildDigest(
     // user exchanges survive these filters in the legacy normalizer.
     includeToolCalls: effectiveIncludeToolCalls,
     includeToolResults: effectiveIncludeToolResults,
     includeCommandMessages,
   });
   const allEntriesWithTools = allEntriesWithToolsBeforeBootstrap.filter(
     (e) =>
       !bootstrapRecordIndexes.has(e.recordIndex) &&
-      !terminalRecordIndexes.has(e.recordIndex),
+      !apiErrorRecordIndexes.has(e.recordIndex),
   );
   const allEntries = allEntriesBeforeBootstrap.filter(
     (e) =>
       !bootstrapRecordIndexes.has(e.recordIndex) &&
-      !terminalRecordIndexes.has(e.recordIndex),
+      !apiErrorRecordIndexes.has(e.recordIndex),
   );
 
   // Filter to only entries with recordIndex >= effectiveFromIndex
   const entriesBeforeTailSlice = allEntries.filter(
     (e) => e.recordIndex >= effectiveFromIndex,
   );
   let filteredEntries = entriesBeforeTailSlice;
 
@@ -1437,18 +1447,27 @@ export async function buildDigest(
         : fullEntriesInRawRange.filter((e) => e.kind === 'command_message')
             .length,
       bootstrapRecords: [...bootstrapRecordIndexes].filter(
         (index) => index >= rawFromIndex,
       ).length,
       bootstrapMessages: fullEntriesInRawRangeBeforeBootstrap.filter((e) =>
         bootstrapRecordIndexes.has(e.recordIndex),
       ).length,
+      ...(includeTerminalEvents
+        ? {
+            apiErrorRecords: [...apiErrorRecordIndexes].filter(
+              (index) => index >= rawFromIndex && index < totalRecords,
+            ).length,
+          }
+        : {}),
       metadataRecords: [...rawRecordIndexes].filter(
-        (index) => !rawRecordIndexesWithAnyEntry.has(index),
+        (index) =>
+          !rawRecordIndexesWithAnyEntry.has(index) &&
+          !apiErrorRecordIndexes.has(index),
       ).length,
       tailSliceEntries: Math.max(
         0,
         entriesBeforeTailSlice.length - filteredEntries.length,
       ),
     },
     recovery: {
       omittedUserMessages: omittedUserMessageRecoveryPointers(
diff --git a/src/skills/session-observer/src/lib/types.ts b/src/skills/session-observer/src/lib/types.ts
index 5a80c886..b52fa13f 100644
--- a/src/skills/session-observer/src/lib/types.ts
+++ b/src/skills/session-observer/src/lib/types.ts
@@ -427,16 +427,18 @@ export interface DigestAccounting {
     askUserEntries: number;
   };
   filtered: {
     toolCalls: number;
     toolResults: number;
     commandMessages: number;
     bootstrapRecords: number;
     bootstrapMessages: number;
+    /** Claude provider API-error records omitted to avoid error-body leakage. */
+    apiErrorRecords?: number;
     metadataRecords: number;
     tailSliceEntries: number;
   };
   recovery: {
     omittedUserMessages: DigestRecoveryPointer[];
   };
   autoLargeDigest: {
     thresholdChars: number;
diff --git a/src/skills/session-observer/src/lib/watch.ts b/src/skills/session-observer/src/lib/watch.ts
index 50ca6165..659f29c6 100644
--- a/src/skills/session-observer/src/lib/watch.ts
+++ b/src/skills/session-observer/src/lib/watch.ts
@@ -90,16 +90,17 @@ interface PendingEntry {
   lastChangedAt: number;
   readyAt?: number | null;
 }
 
 interface WatchEventState {
   pid: number;
   debounceMs: number;
   maxPendingMs: number;
+  /** Delivered delta plus terminal events; excludes heartbeat/control status. */
   eventCount: number;
   lastHeartbeatAt: number;
   heartbeatMs: number | null;
   paused: boolean;
   stopRequested: boolean;
   stopReason: string;
 }
 
@@ -567,17 +568,17 @@ function stoppedEvent(ts: string, reason: string, eventState: WatchEventState) {
     type: 'stopped',
     ts,
     reason,
     eventCount: eventState.eventCount,
   };
 }
 
 function stoppedLine(reason: string, eventState: WatchEventState): string {
-  return `[session-observer] watch stopped reason=${reason} deltaEvents=${eventState.eventCount}\n`;
+  return `[session-observer] watch stopped reason=${reason} events=${eventState.eventCount}\n`;
 }
 
 async function emitStopped(
   args: WatchLoopArgs,
   deps: ResolvedWatchDeps,
   reason: string,
   eventState: WatchEventState,
 ): Promise<void> {
diff --git a/src/skills/session-observer/src/watch.test.ts b/src/skills/session-observer/src/watch.test.ts
index f37e8808..0808265c 100644
--- a/src/skills/session-observer/src/watch.test.ts
+++ b/src/skills/session-observer/src/watch.test.ts
@@ -17,16 +17,17 @@ import {
   symlink,
 } from 'node:fs/promises';
 import { tmpdir } from 'node:os';
 import { join } from 'node:path';
 import { fileURLToPath } from 'node:url';
 
 import { expect, afterEach, describe, test, vi } from 'vitest';
 
+import { renderMarkdown } from './lib/digest.js';
 import { observeCatchUp } from './lib/observe.js';
 import * as watchState from './lib/watch-state.js';
 import { runWatchLoop } from './lib/watch.js';
 
 // ---------------------------------------------------------------------------
 // Classification call-count seam (mirrors locate.test.ts's identical
 // harness): counts real transcript reads at the node:fs/promises readFile
 // boundary — the physical read that both candidateDerivedFields()'s direct
@@ -1189,16 +1190,27 @@ describe('runWatchLoop', () => {
       ]);
       await appendFile(
         transcriptPath,
         [
           {
             type: 'assistant',
             sessionId,
             isAbortedMidStream: true,
+            apiBlockIndex: 0,
+            message: {
+              id: 'assistant-explicit-abort',
+              role: 'assistant',
+              content: [],
+            },
+          },
+          {
+            type: 'assistant',
+            sessionId,
+            apiBlockIndex: 1,
             message: {
               id: 'assistant-explicit-abort',
               role: 'assistant',
               content: [],
             },
           },
           {
             type: 'assistant',
@@ -1231,33 +1243,36 @@ describe('runWatchLoop', () => {
           sleep: async (ms: number) => {
             baselineNow += ms;
           },
           writeStdout: () => {},
         },
       );
       let savedState = await readJsonIfExists(join(stateDir, 'state.json'));
       expect(savedState?.sessions?.[`claude-code:${sessionId}`]).toMatchObject({
-        lastRecordIndex: 3,
+        lastRecordIndex: 4,
       });
 
       await appendFile(
         transcriptPath,
         [
           {
             type: 'user',
             sessionId,
             interruptedMessageId: 'assistant-explicit-abort',
             message: { role: 'user', content: [] },
           },
           {
             type: 'user',
             sessionId,
             interruptedMessageId: 'assistant-interruption-target',
-            message: { role: 'user', content: [] },
+            message: {
+              role: 'user',
+              content: 'operator interruption note survives',
+            },
           },
           {
             type: 'assistant',
             sessionId,
             isApiErrorMessage: true,
             apiErrorStatus: 503,
             message: {
               id: 'assistant-private-api-error',
@@ -1265,16 +1280,26 @@ describe('runWatchLoop', () => {
               content: [
                 {
                   type: 'text',
                   text: 'private Claude provider failure body',
                 },
               ],
             },
           },
+          {
+            type: 'assistant',
+            sessionId,
+            isAbortedMidStream: true,
+            message: {
+              id: 'assistant-partial-output',
+              role: 'assistant',
+              content: 'partial assistant output survives',
+            },
+          },
         ]
           .map((record) => JSON.stringify(record))
           .join('\n') + '\n',
         'utf8',
       );
 
       const stdout: string[] = [];
       let nowMs = Date.UTC(2026, 8, 20, 12, 5, 0);
@@ -1295,50 +1320,89 @@ describe('runWatchLoop', () => {
           sleep: async (ms: number) => {
             nowMs += ms;
           },
           writeStdout: (chunk: string) => stdout.push(chunk),
         },
       );
 
       const events = parseJsonLines(stdout.join(''));
-      expect(result.eventCount).toBe(2);
+      expect(result.eventCount).toBe(4);
       expect(events.filter((event) => event.type === 'terminal')).toEqual([
         expect.objectContaining({
           runtime: 'claude-code',
           sessionId,
           nativeType: 'user-interruption',
           status: 'interrupted',
           source: {
             indexBase: 'zero-based-jsonl-record-index',
-            recordIndex: 4,
-            physicalLine: 5,
+            recordIndex: 5,
+            physicalLine: 6,
             jsonPointer: '/interruptedMessageId',
           },
         }),
         expect.objectContaining({
           runtime: 'claude-code',
           sessionId,
           nativeType: 'assistant',
           status: 'api-error',
           nativeErrorCode: 503,
           source: {
             indexBase: 'zero-based-jsonl-record-index',
-            recordIndex: 5,
-            physicalLine: 6,
+            recordIndex: 6,
+            physicalLine: 7,
+            jsonPointer: '',
+          },
+        }),
+        expect.objectContaining({
+          runtime: 'claude-code',
+          sessionId,
+          nativeType: 'assistant',
+          status: 'aborted-mid-stream',
+          source: {
+            indexBase: 'zero-based-jsonl-record-index',
+            recordIndex: 7,
+            physicalLine: 8,
             jsonPointer: '',
           },
         }),
       ]);
-      expect(events.some((event) => event.type === 'delta')).toBe(false);
+      const deltas = events.filter((event) => event.type === 'delta');
+      expect(deltas).toHaveLength(1);
+      expect(deltas[0]).toMatchObject({
+        ranges: {
+          fromIndex: 4,
+          nextIndex: 8,
+          renderedFromIndex: 5,
+          renderedToIndex: 7,
+        },
+        digest: {
+          accounting: {
+            raw: { count: 4 },
+            rendered: { count: 2 },
+            filtered: { apiErrorRecords: 1, metadataRecords: 1 },
+          },
+          entries: [
+            expect.objectContaining({
+              text: 'operator interruption note survives',
+            }),
+            expect.objectContaining({
+              text: 'partial assistant output survives',
+            }),
+          ],
+        },
+      });
+      expect(renderMarkdown(deltas[0].digest)).toContain(
+        'provider API-error records: 1',
+      );
       expect(stdout.join('')).not.toContain('private Claude provider failure');
       savedState = await readJsonIfExists(join(stateDir, 'state.json'));
       expect(savedState?.sessions?.[`claude-code:${sessionId}`]).toMatchObject({
-        lastRecordIndex: 6,
-        lastTotalRecords: 6,
+        lastRecordIndex: 8,
+        lastTotalRecords: 8,
       });
     });
   });
 
   test('advances filtered-only raw ranges without hiding the next renderable Codex message', async () => {
     await withTempSessionHome(async (home, stateDir) => {
       const cwd = '/test/codex-rearm-filtered';
       const sessionId = 'codex-rearm-filtered';
@@ -4878,16 +4942,18 @@ describe('runWatchLoop', () => {
           },
         },
       );
 
       expect(result.reason).toBe('control-stop');
       expect(
         stdout.join('').includes('watch stopped reason=control-stop'),
       ).toBeTruthy();
+      expect(stdout.join('')).toContain('events=0');
+      expect(stdout.join('')).not.toContain('deltaEvents=');
 
       const watchJson = JSON.parse(
         await readFile(join(stateDir, 'watch.json'), 'utf8'),
       );
       expect(watchJson.active).toBe(null);
       expect(await readJsonIfExists(join(stateDir, 'watch.control.json'))).toBe(
         null,
       );

```
