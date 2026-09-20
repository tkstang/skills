# Immutable phase review packet

Captured: 2026-09-20T21:35:25.150034+00:00
Repository: /Users/tstang/orca/workspaces/skills/session-fidelity
Base: 73e1752b57e03878a908f506622142a5115b41e2
Reviewed HEAD: 0e0843fe8cac61cda4b0c609ca9fba4f9a310261
Checkout status: clean

## Request

Independently review ONLY phase p01 from captured phase base through HEAD against .oat/projects/shared/session-evidence-followups/plan.md tasks p01-t01 and p01-t02. Sol implementation receives your review before the next product phase. Do not edit files or invoke providers. Focus on authored diff and consequential generated propagation, not unchanged bundles broadly.

Requirements: condition-based SIGTERM rearm test and clean child handling; 50 consecutive runs including CPU load (host will preserve report/log), three fixing-PR CI validate successes remain a later acceptance boundary. Unsuccessful terminal watch events cover exact Claude, Codex and Cursor native semantics described in plan, respect consumed-range/checkpoint restart dedup, survive quiet-empty and remain metadata-only. They cannot authorize peer-message delivery or continuation. Claude explicit APIerror/abort/truncated flags and joined interruption pointers with duplicate suppression; no generic tool errors or unsupported signal heuristics. Codex task_complete error and turn_aborted, structured code; inferred retry text only for usage_limit_exceeded, anchored clock/date grammar includes native ordinal date Sep 19th, 2026 5:01 AM. No timezone/absolute instant guess or message body leakage. Cursor failure frame indices and session identity must be faithful. Watch and activity semantics should not diverge for same Codex fixture. Version/changelog/docs/generated units consistent.

Report substantive correctness, safety, maintainability and missing meaningful verification findings. Inspect the phase diff plus necessary source context. Response contract: findings use an external-document anchor into this packet with its exact captured SHA256; name the affected source file and line in the claim and evidence. If there are no Critical/High findings use verdict pass even if Medium/Low remain; changes_requested requires at least one Critical/High. Inconclusive only for actual missing necessary evidence. Don't inflate severity. Distinguish proven defect from speculation. Any raw private transcript bodies are outside scope; use synthetic fixtures/native schema docs.


## Scope adaptation

The base-branch selector captures entire before/after files including generated bundles and is capped at 2 MiB. This packet preserves the exact authored before/after Git diff (including deletions), all changed-file hashes, and immutable base/head references instead. Generated content is checked by build:check and version validation, with parity inspected where needed. The reviewer may read repository context and git-show either immutable revision but must not mutate any file or invoke providers. The whole checkout stays stable during review. Findings should use an anchor into THIS external packet with the exact packet SHA256 supplied by the wrapper; name the affected repository path/line in the claim/evidence. Never invent captured repository locations for files that are only context. This is a code-diff review carried as an external document, not an architecture-only plan review.

## Changed file manifest

```json
[
  {
    "path": ".oat/projects/shared/session-evidence-followups/evidence/p01-final-stress.log",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 30114,
      "sha256": "e3b9a6ad30da3f00d02c65b2c2d5db71daa7fcd6a3e348c1f67a8a7fa44b1e82"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/evidence/p01-stress-harness.sh",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 1125,
      "sha256": "0bb8c9866ac9a2bb4214dd8dd8677fee18367b2358c6703a3b12a5594a2331f6"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/implementation.md",
    "generated": false,
    "base": {
      "bytes": 5460,
      "sha256": "0bcc6a6328519ed0a6d3a8ba1ff8d21418a7c401e90ebb68e9062442a717eb7a"
    },
    "head": {
      "bytes": 8162,
      "sha256": "1159062d9f796fd34076a9fd235108642a1936f8490dc712d99e4f36fb4cb1a5"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/plan.md",
    "generated": false,
    "base": {
      "bytes": 28976,
      "sha256": "a670e0d4dc0c09b358274923e21728d9b50f367f61a5dc3089241ea2d9228608"
    },
    "head": {
      "bytes": 29004,
      "sha256": "a3128362744abdd7ec2af7869dc64887b2113d6c69c1f2e62afaf11528b35c44"
    }
  },
  {
    "path": ".oat/projects/shared/session-evidence-followups/state.md",
    "generated": false,
    "base": {
      "bytes": 6767,
      "sha256": "d90d9ea666b80a1cc67cb218fe3cb39bd765a4511764f2302293f0ad744bd9cb"
    },
    "head": {
      "bytes": 6817,
      "sha256": "6296f0ced292b32f392f0069ad5fbfd1642027866c09018c2643378cb3440f30"
    }
  },
  {
    "path": "CHANGELOG.md",
    "generated": false,
    "base": {
      "bytes": 39121,
      "sha256": "327856e50801a95ffdc6793339b5ab41701119db444d92a5c0639bf5d52a0f1f"
    },
    "head": {
      "bytes": 40018,
      "sha256": "7ca5eb6b5c7df89517515e983b892a5f442fea995c304e896c8add94140a8aaa"
    }
  },
  {
    "path": "documentation/docs/user-guide/skills/session-observer.md",
    "generated": false,
    "base": {
      "bytes": 19383,
      "sha256": "d200ee88ae20f6d8e2ab2791dbb24c23bb98aa032ce78f0b7f1f04ae18b94452"
    },
    "head": {
      "bytes": 21032,
      "sha256": "dde88a74f8d1fee851d7e24bcf728ffbe7345c2e2edb67bd8177decbd3250249"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 21438,
      "sha256": "d0a119cc58873ef23ee490cc30a21e53da1da8d433497dbdb76ee78554dc7e00"
    },
    "head": {
      "bytes": 21438,
      "sha256": "375db7139a6c43f27a13582a7d52c5b8d0ff101628f6b3567a027033f465ae64"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/claude-monitor.mjs",
    "generated": true,
    "base": {
      "bytes": 295264,
      "sha256": "325d10fbc9e84104f2dcf445942342515002363450ed73914cc2e52aa22a9dda"
    },
    "head": {
      "bytes": 303750,
      "sha256": "2272fd19db665f34b0889b4a4fe58bdb88b209d91732a27016d4abe5b1706768"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/collab-control.mjs",
    "generated": true,
    "base": {
      "bytes": 114342,
      "sha256": "8799fd07d2d1f76ec87a9718fefee4a5514b5cabf07f3612601fb30047f04910"
    },
    "head": {
      "bytes": 114608,
      "sha256": "aa5272262bbaf63e31d6bb471f9a8c180ac8cc9353a37b8a4a4d45542cbb524c"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/hooks/codex-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 273479,
      "sha256": "784fe51fef92d3efd9ad8194d381e54c8aafb83baa8bb5b15d749da1fe0cd71a"
    },
    "head": {
      "bytes": 281965,
      "sha256": "f6cfe2a6175c0e5e425ea512b4f8d26d57f04804f194bf3ab45c74fcc29b73e0"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/hooks/cursor-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 216241,
      "sha256": "3ed77713ca52aff8f3c4dd3eb887db239f42b84a55af44caaa74a0f4c0023370"
    },
    "head": {
      "bytes": 224727,
      "sha256": "fc24909c2c5f4da60080d2c7949a8d1d1e3bb883e0cd41dbf378320ef5414b58"
    }
  },
  {
    "path": "plugins/consensus/skills/observer-collab/scripts/lib/selected-prefix.mjs",
    "generated": true,
    "base": {
      "bytes": 157428,
      "sha256": "046aa026695004a51c6fb99a6fb63ec67923de681c2a3e4e8d1d58843f1ad95f"
    },
    "head": {
      "bytes": 165909,
      "sha256": "bbb4db27c38dcfebc4ec0a774e0ff8e12663491b89aa5c178fcb937fc17d048e"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 46538,
      "sha256": "37182fa8d900059403620a23ad2bb4031baa829e2d1f07fd5e44c36be13e9def"
    },
    "head": {
      "bytes": 48226,
      "sha256": "4a663be7bee714555469ea1904b4be09159a24a10f631cad4db6daf2776fc4a6"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/digest.mjs",
    "generated": true,
    "base": {
      "bytes": 144437,
      "sha256": "a2ecd6fac504b5a18b11e7454e19794f10f105077ce27a4aa32cd494e5dd23f8"
    },
    "head": {
      "bytes": 152923,
      "sha256": "71505d565f26b9a5824e6998b50a0de7d4a791e9bdde81b8cf0dd2d9e039e087"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/observe.mjs",
    "generated": true,
    "base": {
      "bytes": 314833,
      "sha256": "fdcf5d4034cdf4df4c940fd0e121432a8362a9b7f699b03c36385dddbbd17a05"
    },
    "head": {
      "bytes": 323366,
      "sha256": "d8283d1d387cdc9648150a5193f7abe9b575e9d648469395e8cb574dd643c3be"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/lib/watch.mjs",
    "generated": true,
    "base": {
      "bytes": 388362,
      "sha256": "7f7f031278bc34105dc563e6bbc333f2210c331f8dcc614a584c259ae9d57668"
    },
    "head": {
      "bytes": 397721,
      "sha256": "b8579dc9e8362e160d3ef8557e8e3cf3249f723d856fdf62602c8eb2b95be882"
    }
  },
  {
    "path": "plugins/consensus/skills/observer/scripts/session-observer.mjs",
    "generated": true,
    "base": {
      "bytes": 457853,
      "sha256": "94910356e08e359b3a55368ddce24589fcb7d07dac8be395adc1d36b856efbaa"
    },
    "head": {
      "bytes": 467208,
      "sha256": "d9ae4dcb62eb1d67ec21af59f690771cff6f5a751f2043168ffbe299a884e418"
    }
  },
  {
    "path": "plugins/session/skills/export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 11592,
      "sha256": "e23f199cba0b920111cfcd16b84e7481dcc9391d66355e37b5fe1e386efd2282"
    },
    "head": {
      "bytes": 11592,
      "sha256": "e88c5622c41b0bd804cb33c9380973b50070601d6f185a3bdef4ade5cc0fe3c5"
    }
  },
  {
    "path": "plugins/session/skills/export-transcript/scripts/session-export-transcript.mjs",
    "generated": true,
    "base": {
      "bytes": 140692,
      "sha256": "ef96edbc0d38f0e315fc180e8f175f5bf773719ea2086f1ed44e78f43a55b201"
    },
    "head": {
      "bytes": 141827,
      "sha256": "adc72eb850df7a252c7c431a9a25bfb26d5c2f4d32d830a361ed4a31e7b02d3a"
    }
  },
  {
    "path": "plugins/session/skills/fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4412,
      "sha256": "5842f6bd9ddd32b72f4f6c899f797a8f9c9fa7ff62edeb0b096921589874d61e"
    },
    "head": {
      "bytes": 4412,
      "sha256": "03aae68dc261450a427e6caa33045368881ebec5bfdd8d73e9176fe20c6b4466"
    }
  },
  {
    "path": "skills/session-export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 11608,
      "sha256": "34ae2125d270e604ac99de7dcf0010c0bf4663e27b822a9633f868907e2a9c21"
    },
    "head": {
      "bytes": 11608,
      "sha256": "13617f63068faa23a20a1878f4e03b4dc5df646f78d545476622e70e35af3a17"
    }
  },
  {
    "path": "skills/session-export-transcript/scripts/session-export-transcript.mjs",
    "generated": true,
    "base": {
      "bytes": 140692,
      "sha256": "ef96edbc0d38f0e315fc180e8f175f5bf773719ea2086f1ed44e78f43a55b201"
    },
    "head": {
      "bytes": 141827,
      "sha256": "adc72eb850df7a252c7c431a9a25bfb26d5c2f4d32d830a361ed4a31e7b02d3a"
    }
  },
  {
    "path": "skills/session-fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4428,
      "sha256": "a82183415f1b84c4c8113ab6681054c71cc68be9500843b525e949fcb1ef978c"
    },
    "head": {
      "bytes": 4428,
      "sha256": "b0ef0c6c4f7f73ca3490dae88dd57b71e879db6dc2a923ba8f3db3cd0669c05a"
    }
  },
  {
    "path": "skills/session-observer-collab/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 21502,
      "sha256": "c6671df0af54179ddd87d10548a01ae169595edcc4f966d59aa5f334b1abbb00"
    },
    "head": {
      "bytes": 21502,
      "sha256": "8c6b4d2ed6666da8ded0fa82a363d5448073b592bbdc46b56454477c33774259"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/claude-monitor.mjs",
    "generated": true,
    "base": {
      "bytes": 295264,
      "sha256": "325d10fbc9e84104f2dcf445942342515002363450ed73914cc2e52aa22a9dda"
    },
    "head": {
      "bytes": 303750,
      "sha256": "2272fd19db665f34b0889b4a4fe58bdb88b209d91732a27016d4abe5b1706768"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/collab-control.mjs",
    "generated": true,
    "base": {
      "bytes": 114342,
      "sha256": "8799fd07d2d1f76ec87a9718fefee4a5514b5cabf07f3612601fb30047f04910"
    },
    "head": {
      "bytes": 114608,
      "sha256": "aa5272262bbaf63e31d6bb471f9a8c180ac8cc9353a37b8a4a4d45542cbb524c"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/hooks/codex-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 273479,
      "sha256": "784fe51fef92d3efd9ad8194d381e54c8aafb83baa8bb5b15d749da1fe0cd71a"
    },
    "head": {
      "bytes": 281965,
      "sha256": "f6cfe2a6175c0e5e425ea512b4f8d26d57f04804f194bf3ab45c74fcc29b73e0"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/hooks/cursor-stop.mjs",
    "generated": true,
    "base": {
      "bytes": 216241,
      "sha256": "3ed77713ca52aff8f3c4dd3eb887db239f42b84a55af44caaa74a0f4c0023370"
    },
    "head": {
      "bytes": 224727,
      "sha256": "fc24909c2c5f4da60080d2c7949a8d1d1e3bb883e0cd41dbf378320ef5414b58"
    }
  },
  {
    "path": "skills/session-observer-collab/scripts/lib/selected-prefix.mjs",
    "generated": true,
    "base": {
      "bytes": 157428,
      "sha256": "046aa026695004a51c6fb99a6fb63ec67923de681c2a3e4e8d1d58843f1ad95f"
    },
    "head": {
      "bytes": 165909,
      "sha256": "bbb4db27c38dcfebc4ec0a774e0ff8e12663491b89aa5c178fcb937fc17d048e"
    }
  },
  {
    "path": "skills/session-observer/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 46554,
      "sha256": "798a1288fe24342ec63cc68b60cec79e71d2f552a260b1731aa375931d7ebb2b"
    },
    "head": {
      "bytes": 48242,
      "sha256": "0d6f373ae04ea3204f7d9f5376559fcb0f96cf132184d42fee22cbdad775b07e"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/digest.mjs",
    "generated": true,
    "base": {
      "bytes": 144437,
      "sha256": "a2ecd6fac504b5a18b11e7454e19794f10f105077ce27a4aa32cd494e5dd23f8"
    },
    "head": {
      "bytes": 152923,
      "sha256": "71505d565f26b9a5824e6998b50a0de7d4a791e9bdde81b8cf0dd2d9e039e087"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/observe.mjs",
    "generated": true,
    "base": {
      "bytes": 314833,
      "sha256": "fdcf5d4034cdf4df4c940fd0e121432a8362a9b7f699b03c36385dddbbd17a05"
    },
    "head": {
      "bytes": 323366,
      "sha256": "d8283d1d387cdc9648150a5193f7abe9b575e9d648469395e8cb574dd643c3be"
    }
  },
  {
    "path": "skills/session-observer/scripts/lib/watch.mjs",
    "generated": true,
    "base": {
      "bytes": 388362,
      "sha256": "7f7f031278bc34105dc563e6bbc333f2210c331f8dcc614a584c259ae9d57668"
    },
    "head": {
      "bytes": 397721,
      "sha256": "b8579dc9e8362e160d3ef8557e8e3cf3249f723d856fdf62602c8eb2b95be882"
    }
  },
  {
    "path": "skills/session-observer/scripts/session-observer.mjs",
    "generated": true,
    "base": {
      "bytes": 457853,
      "sha256": "94910356e08e359b3a55368ddce24589fcb7d07dac8be395adc1d36b856efbaa"
    },
    "head": {
      "bytes": 467208,
      "sha256": "d9ae4dcb62eb1d67ec21af59f690771cff6f5a751f2043168ffbe299a884e418"
    }
  },
  {
    "path": "src/shared/transcript/activity/codex.ts",
    "generated": false,
    "base": {
      "bytes": 15355,
      "sha256": "a4487b95ed5b19489ad263bbc384961776540d831f3712b26705bddb338c07b8"
    },
    "head": {
      "bytes": 14944,
      "sha256": "503a4646391fa3343f1ca18f89bdee1090b9694014bfc9653443b6c50c004304"
    }
  },
  {
    "path": "src/shared/transcript/terminal-events.test.ts",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 11101,
      "sha256": "d78f4acf49c89cb778f9c81878a4594772f8ca7fcf9e14d44f82b5793203bb85"
    }
  },
  {
    "path": "src/shared/transcript/terminal-events.ts",
    "generated": false,
    "base": null,
    "head": {
      "bytes": 10917,
      "sha256": "7461162abe9a9023d1663d0ece547133494bfbcfb8067d350cb9d344d3ba6cc8"
    }
  },
  {
    "path": "src/skills/session-export-transcript/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 11604,
      "sha256": "413d019ef136e2e5972f26d281cc3c30620d36706a9d0adafee10bfc88c0abf0"
    },
    "head": {
      "bytes": 11604,
      "sha256": "ef01cd80c682e3c59a669b21f91ab05fbd09e8539ebe59228b0bdeb4d50a69ec"
    }
  },
  {
    "path": "src/skills/session-fork-to-destination/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 4422,
      "sha256": "3833d89ec9325e52a0c21d9de3780d03bc043e064a495239d1eade72a4f62824"
    },
    "head": {
      "bytes": 4422,
      "sha256": "47c4f53b042930483b11683c14ffe322dbd2a2847ec159abe80dbefa71dad124"
    }
  },
  {
    "path": "src/skills/session-observer-collab/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 21541,
      "sha256": "eb026e5eaf88adffd1a1792ac906f9f7e4786b75eafc9b1595c4a9730fb9d02a"
    },
    "head": {
      "bytes": 21541,
      "sha256": "0e13bbf6612592ed0ff093c2259632510127f28ed944d2e7e301f4b5438f8c21"
    }
  },
  {
    "path": "src/skills/session-observer-collab/src/completion.test.ts",
    "generated": false,
    "base": {
      "bytes": 25562,
      "sha256": "1775c9d998b203ebe8e1ca29f247fa2183b65d1ccf50cdc3b379d6f56ccd612b"
    },
    "head": {
      "bytes": 26329,
      "sha256": "6cb19281e0e07ea1afd8ec2563559c1b8be6dcf05409842885ab7d81edafbf47"
    }
  },
  {
    "path": "src/skills/session-observer/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 46559,
      "sha256": "246f43cfd0b0f3ed04bf6ed9969e081cbcbeba3f87ca96e080a169613f2813b0"
    },
    "head": {
      "bytes": 48247,
      "sha256": "5b0c74b728389db76fb57024932c364a1aefabd69c3d6248da0e1978109249ed"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/digest.ts",
    "generated": false,
    "base": {
      "bytes": 53622,
      "sha256": "3e95394c813ac15c3c61041361d2790570065b032a768f7b47238d902ae1cfcc"
    },
    "head": {
      "bytes": 54964,
      "sha256": "7fc07e7460f3abe5097b525e0f6da4bc14067b68c7202accd47972ddeddff24c"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/observe.ts",
    "generated": false,
    "base": {
      "bytes": 54820,
      "sha256": "37440599e77bafad257096c3d22ef0cde3e717ea30895fab66e1284c80a7273e"
    },
    "head": {
      "bytes": 54874,
      "sha256": "109a47c3742ec9ee6e3e8a7fbd1a25316a2e6c69a201c831aaee1a4abc60f3d4"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/types.ts",
    "generated": false,
    "base": {
      "bytes": 25454,
      "sha256": "2f338eea8456156062a2158e392f063f96a5de9d0f124a52a1fe66d8118827ef"
    },
    "head": {
      "bytes": 25808,
      "sha256": "807388f2cbac3a688ba1fbbda77042fab097c9a083649742dfdd4bcc13fec633"
    }
  },
  {
    "path": "src/skills/session-observer/src/lib/watch.ts",
    "generated": false,
    "base": {
      "bytes": 60179,
      "sha256": "eadb4b87f7addeb9113831a4715be5951bedc88cc66cd18cde09dcc7085f4e6b"
    },
    "head": {
      "bytes": 61518,
      "sha256": "4c15fce216d6efa95e0b9ad41ee8a1788004c0c8b163f5a09c8bfc63704cf4e6"
    }
  },
  {
    "path": "src/skills/session-observer/src/watch.test.ts",
    "generated": false,
    "base": {
      "bytes": 153206,
      "sha256": "777637ade6a1bf343cbab36d4eb629ce967260d86e16d0baae190c85a3e5294b"
    },
    "head": {
      "bytes": 164260,
      "sha256": "0b9b227f51965f5364d859207415012c5112f764279a8dd2357591fa895656df"
    }
  }
]
```

## Authored before/after diff

```diff
diff --git a/.oat/projects/shared/session-evidence-followups/evidence/p01-final-stress.log b/.oat/projects/shared/session-evidence-followups/evidence/p01-final-stress.log
new file mode 100644
index 00000000..a646c8ad
--- /dev/null
+++ b/.oat/projects/shared/session-evidence-followups/evidence/p01-final-stress.log
@@ -0,0 +1,753 @@
+iteration=01 status=start at=2026-09-20T21:29:29Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:29
+   Duration  611ms (transform 198ms, setup 0ms, import 237ms, tests 276ms, environment 0ms)
+
+iteration=01 status=pass at=2026-09-20T21:29:30Z cpu_load=none
+iteration=02 status=start at=2026-09-20T21:29:30Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:31
+   Duration  588ms (transform 178ms, setup 0ms, import 214ms, tests 290ms, environment 0ms)
+
+iteration=02 status=pass at=2026-09-20T21:29:31Z cpu_load=none
+iteration=03 status=start at=2026-09-20T21:29:31Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:32
+   Duration  589ms (transform 185ms, setup 0ms, import 221ms, tests 284ms, environment 0ms)
+
+iteration=03 status=pass at=2026-09-20T21:29:33Z cpu_load=none
+iteration=04 status=start at=2026-09-20T21:29:33Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:33
+   Duration  637ms (transform 203ms, setup 0ms, import 243ms, tests 297ms, environment 0ms)
+
+iteration=04 status=pass at=2026-09-20T21:29:34Z cpu_load=none
+iteration=05 status=start at=2026-09-20T21:29:34Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:35
+   Duration  680ms (transform 228ms, setup 0ms, import 275ms, tests 301ms, environment 0ms)
+
+iteration=05 status=pass at=2026-09-20T21:29:35Z cpu_load=none
+iteration=06 status=start at=2026-09-20T21:29:35Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:36
+   Duration  646ms (transform 220ms, setup 0ms, import 263ms, tests 285ms, environment 0ms)
+
+iteration=06 status=pass at=2026-09-20T21:29:37Z cpu_load=none
+iteration=07 status=start at=2026-09-20T21:29:37Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:37
+   Duration  587ms (transform 187ms, setup 0ms, import 226ms, tests 271ms, environment 0ms)
+
+iteration=07 status=pass at=2026-09-20T21:29:38Z cpu_load=none
+iteration=08 status=start at=2026-09-20T21:29:38Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:39
+   Duration  582ms (transform 181ms, setup 0ms, import 216ms, tests 281ms, environment 0ms)
+
+iteration=08 status=pass at=2026-09-20T21:29:39Z cpu_load=none
+iteration=09 status=start at=2026-09-20T21:29:39Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:40
+   Duration  597ms (transform 189ms, setup 0ms, import 224ms, tests 289ms, environment 0ms)
+
+iteration=09 status=pass at=2026-09-20T21:29:41Z cpu_load=none
+iteration=10 status=start at=2026-09-20T21:29:41Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:41
+   Duration  633ms (transform 189ms, setup 0ms, import 227ms, tests 316ms, environment 0ms)
+
+iteration=10 status=pass at=2026-09-20T21:29:42Z cpu_load=none
+cpu-load start pid=30499 iteration=11
+iteration=11 status=start at=2026-09-20T21:29:42Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:43
+   Duration  622ms (transform 197ms, setup 0ms, import 234ms, tests 300ms, environment 0ms)
+
+iteration=11 status=pass at=2026-09-20T21:29:43Z cpu_load=30499
+iteration=12 status=start at=2026-09-20T21:29:43Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:44
+   Duration  637ms (transform 185ms, setup 0ms, import 221ms, tests 329ms, environment 0ms)
+
+iteration=12 status=pass at=2026-09-20T21:29:45Z cpu_load=30499
+iteration=13 status=start at=2026-09-20T21:29:45Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:45
+   Duration  620ms (transform 213ms, setup 0ms, import 255ms, tests 278ms, environment 0ms)
+
+iteration=13 status=pass at=2026-09-20T21:29:46Z cpu_load=30499
+iteration=14 status=start at=2026-09-20T21:29:46Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:47
+   Duration  589ms (transform 190ms, setup 0ms, import 226ms, tests 272ms, environment 0ms)
+
+iteration=14 status=pass at=2026-09-20T21:29:47Z cpu_load=30499
+iteration=15 status=start at=2026-09-20T21:29:47Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:48
+   Duration  588ms (transform 190ms, setup 0ms, import 225ms, tests 275ms, environment 0ms)
+
+iteration=15 status=pass at=2026-09-20T21:29:49Z cpu_load=30499
+iteration=16 status=start at=2026-09-20T21:29:49Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:49
+   Duration  600ms (transform 191ms, setup 0ms, import 227ms, tests 287ms, environment 0ms)
+
+iteration=16 status=pass at=2026-09-20T21:29:50Z cpu_load=30499
+iteration=17 status=start at=2026-09-20T21:29:50Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:51
+   Duration  626ms (transform 210ms, setup 0ms, import 253ms, tests 286ms, environment 0ms)
+
+iteration=17 status=pass at=2026-09-20T21:29:51Z cpu_load=30499
+iteration=18 status=start at=2026-09-20T21:29:51Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:52
+   Duration  592ms (transform 188ms, setup 0ms, import 224ms, tests 279ms, environment 0ms)
+
+iteration=18 status=pass at=2026-09-20T21:29:52Z cpu_load=30499
+iteration=19 status=start at=2026-09-20T21:29:52Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:53
+   Duration  592ms (transform 189ms, setup 0ms, import 224ms, tests 281ms, environment 0ms)
+
+iteration=19 status=pass at=2026-09-20T21:29:54Z cpu_load=30499
+iteration=20 status=start at=2026-09-20T21:29:54Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:54
+   Duration  607ms (transform 194ms, setup 0ms, import 231ms, tests 287ms, environment 0ms)
+
+iteration=20 status=pass at=2026-09-20T21:29:55Z cpu_load=30499
+iteration=21 status=start at=2026-09-20T21:29:55Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:56
+   Duration  593ms (transform 188ms, setup 0ms, import 227ms, tests 277ms, environment 0ms)
+
+iteration=21 status=pass at=2026-09-20T21:29:56Z cpu_load=30499
+iteration=22 status=start at=2026-09-20T21:29:56Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:57
+   Duration  595ms (transform 192ms, setup 0ms, import 228ms, tests 275ms, environment 0ms)
+
+iteration=22 status=pass at=2026-09-20T21:29:58Z cpu_load=30499
+iteration=23 status=start at=2026-09-20T21:29:58Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:29:58
+   Duration  600ms (transform 191ms, setup 0ms, import 227ms, tests 285ms, environment 0ms)
+
+iteration=23 status=pass at=2026-09-20T21:29:59Z cpu_load=30499
+iteration=24 status=start at=2026-09-20T21:29:59Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:00
+   Duration  611ms (transform 199ms, setup 0ms, import 238ms, tests 285ms, environment 0ms)
+
+iteration=24 status=pass at=2026-09-20T21:30:00Z cpu_load=30499
+iteration=25 status=start at=2026-09-20T21:30:00Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:01
+   Duration  593ms (transform 192ms, setup 0ms, import 228ms, tests 278ms, environment 0ms)
+
+iteration=25 status=pass at=2026-09-20T21:30:02Z cpu_load=30499
+iteration=26 status=start at=2026-09-20T21:30:02Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:02
+   Duration  600ms (transform 195ms, setup 0ms, import 230ms, tests 282ms, environment 0ms)
+
+iteration=26 status=pass at=2026-09-20T21:30:03Z cpu_load=30499
+iteration=27 status=start at=2026-09-20T21:30:03Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:04
+   Duration  610ms (transform 193ms, setup 0ms, import 229ms, tests 291ms, environment 0ms)
+
+iteration=27 status=pass at=2026-09-20T21:30:04Z cpu_load=30499
+iteration=28 status=start at=2026-09-20T21:30:04Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:05
+   Duration  646ms (transform 231ms, setup 0ms, import 275ms, tests 277ms, environment 0ms)
+
+iteration=28 status=pass at=2026-09-20T21:30:06Z cpu_load=30499
+iteration=29 status=start at=2026-09-20T21:30:06Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:06
+   Duration  597ms (transform 191ms, setup 0ms, import 227ms, tests 278ms, environment 0ms)
+
+iteration=29 status=pass at=2026-09-20T21:30:07Z cpu_load=30499
+iteration=30 status=start at=2026-09-20T21:30:07Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:08
+   Duration  605ms (transform 189ms, setup 0ms, import 226ms, tests 288ms, environment 0ms)
+
+iteration=30 status=pass at=2026-09-20T21:30:08Z cpu_load=30499
+iteration=31 status=start at=2026-09-20T21:30:08Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:09
+   Duration  613ms (transform 195ms, setup 0ms, import 234ms, tests 292ms, environment 0ms)
+
+iteration=31 status=pass at=2026-09-20T21:30:09Z cpu_load=30499
+iteration=32 status=start at=2026-09-20T21:30:09Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:10
+   Duration  595ms (transform 194ms, setup 0ms, import 230ms, tests 277ms, environment 0ms)
+
+iteration=32 status=pass at=2026-09-20T21:30:11Z cpu_load=30499
+iteration=33 status=start at=2026-09-20T21:30:11Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:12
+   Duration  602ms (transform 194ms, setup 0ms, import 230ms, tests 279ms, environment 0ms)
+
+iteration=33 status=pass at=2026-09-20T21:30:12Z cpu_load=30499
+iteration=34 status=start at=2026-09-20T21:30:12Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:13
+   Duration  576ms (transform 183ms, setup 0ms, import 220ms, tests 264ms, environment 0ms)
+
+iteration=34 status=pass at=2026-09-20T21:30:13Z cpu_load=30499
+iteration=35 status=start at=2026-09-20T21:30:13Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:14
+   Duration  617ms (transform 205ms, setup 0ms, import 242ms, tests 287ms, environment 0ms)
+
+iteration=35 status=pass at=2026-09-20T21:30:15Z cpu_load=30499
+iteration=36 status=start at=2026-09-20T21:30:15Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:15
+   Duration  705ms (transform 256ms, setup 0ms, import 306ms, tests 295ms, environment 0ms)
+
+iteration=36 status=pass at=2026-09-20T21:30:16Z cpu_load=30499
+iteration=37 status=start at=2026-09-20T21:30:16Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:17
+   Duration  680ms (transform 224ms, setup 0ms, import 272ms, tests 305ms, environment 0ms)
+
+iteration=37 status=pass at=2026-09-20T21:30:18Z cpu_load=30499
+iteration=38 status=start at=2026-09-20T21:30:18Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:18
+   Duration  602ms (transform 195ms, setup 0ms, import 232ms, tests 278ms, environment 0ms)
+
+iteration=38 status=pass at=2026-09-20T21:30:19Z cpu_load=30499
+iteration=39 status=start at=2026-09-20T21:30:19Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:20
+   Duration  598ms (transform 193ms, setup 0ms, import 229ms, tests 276ms, environment 0ms)
+
+iteration=39 status=pass at=2026-09-20T21:30:20Z cpu_load=30499
+iteration=40 status=start at=2026-09-20T21:30:20Z cpu_load=30499
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:21
+   Duration  599ms (transform 196ms, setup 0ms, import 237ms, tests 268ms, environment 0ms)
+
+iteration=40 status=pass at=2026-09-20T21:30:22Z cpu_load=30499
+cpu-load stop pid=30499 iteration=41
+iteration=41 status=start at=2026-09-20T21:30:22Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:22
+   Duration  604ms (transform 193ms, setup 0ms, import 229ms, tests 286ms, environment 0ms)
+
+iteration=41 status=pass at=2026-09-20T21:30:23Z cpu_load=none
+iteration=42 status=start at=2026-09-20T21:30:23Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:24
+   Duration  576ms (transform 191ms, setup 0ms, import 228ms, tests 257ms, environment 0ms)
+
+iteration=42 status=pass at=2026-09-20T21:30:24Z cpu_load=none
+iteration=43 status=start at=2026-09-20T21:30:24Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:25
+   Duration  570ms (transform 186ms, setup 0ms, import 221ms, tests 262ms, environment 0ms)
+
+iteration=43 status=pass at=2026-09-20T21:30:25Z cpu_load=none
+iteration=44 status=start at=2026-09-20T21:30:25Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:26
+   Duration  596ms (transform 186ms, setup 0ms, import 224ms, tests 282ms, environment 0ms)
+
+iteration=44 status=pass at=2026-09-20T21:30:27Z cpu_load=none
+iteration=45 status=start at=2026-09-20T21:30:27Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:27
+   Duration  590ms (transform 182ms, setup 0ms, import 218ms, tests 279ms, environment 0ms)
+
+iteration=45 status=pass at=2026-09-20T21:30:28Z cpu_load=none
+iteration=46 status=start at=2026-09-20T21:30:28Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:29
+   Duration  631ms (transform 192ms, setup 0ms, import 230ms, tests 309ms, environment 0ms)
+
+iteration=46 status=pass at=2026-09-20T21:30:29Z cpu_load=none
+iteration=47 status=start at=2026-09-20T21:30:29Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:30
+   Duration  594ms (transform 184ms, setup 0ms, import 219ms, tests 287ms, environment 0ms)
+
+iteration=47 status=pass at=2026-09-20T21:30:31Z cpu_load=none
+iteration=48 status=start at=2026-09-20T21:30:31Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:31
+   Duration  599ms (transform 206ms, setup 0ms, import 244ms, tests 266ms, environment 0ms)
+
+iteration=48 status=pass at=2026-09-20T21:30:32Z cpu_load=none
+iteration=49 status=start at=2026-09-20T21:30:32Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:33
+   Duration  579ms (transform 184ms, setup 0ms, import 219ms, tests 269ms, environment 0ms)
+
+iteration=49 status=pass at=2026-09-20T21:30:33Z cpu_load=none
+iteration=50 status=start at=2026-09-20T21:30:33Z cpu_load=none
+
+> skills@0.1.0 test:vitest /Users/tstang/orca/workspaces/skills/session-fidelity
+> node scripts/run-vitest.mjs src/skills/session-observer/src/watch.test.ts -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+
+
+ RUN  v4.1.9 /Users/tstang/orca/workspaces/skills/session-fidelity
+
+
+ Test Files  1 passed (1)
+      Tests  1 passed | 59 skipped (60)
+   Start at  16:30:34
+   Duration  643ms (transform 188ms, setup 0ms, import 224ms, tests 328ms, environment 0ms)
+
+iteration=50 status=pass at=2026-09-20T21:30:35Z cpu_load=none
+summary iterations=50 passed=50 failed=0 loaded_iterations=30 cleanup=complete
diff --git a/.oat/projects/shared/session-evidence-followups/evidence/p01-stress-harness.sh b/.oat/projects/shared/session-evidence-followups/evidence/p01-stress-harness.sh
new file mode 100644
index 00000000..12653f35
--- /dev/null
+++ b/.oat/projects/shared/session-evidence-followups/evidence/p01-stress-harness.sh
@@ -0,0 +1,35 @@
+#!/bin/bash
+set -euo pipefail
+
+load_pid=''
+cleanup() {
+  if [ -n "$load_pid" ] && kill -0 "$load_pid" 2>/dev/null; then
+    kill "$load_pid" 2>/dev/null || true
+    wait "$load_pid" 2>/dev/null || true
+  fi
+}
+trap cleanup EXIT INT TERM
+
+for iteration in $(seq 1 50); do
+  if [ "$iteration" -eq 11 ]; then
+    node -e 'while (true) {}' &
+    load_pid=$!
+    printf 'cpu-load start pid=%s iteration=%s\n' "$load_pid" "$iteration"
+  fi
+  if [ "$iteration" -eq 41 ]; then
+    cleanup
+    printf 'cpu-load stop pid=%s iteration=%s\n' "$load_pid" "$iteration"
+    load_pid=''
+  fi
+
+  started_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
+  printf 'iteration=%02d status=start at=%s cpu_load=%s\n' \
+    "$iteration" "$started_at" "${load_pid:-none}"
+  pnpm run test:vitest src/skills/session-observer/src/watch.test.ts \
+    -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
+  finished_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
+  printf 'iteration=%02d status=pass at=%s cpu_load=%s\n' \
+    "$iteration" "$finished_at" "${load_pid:-none}"
+done
+
+printf 'summary iterations=50 passed=50 failed=0 loaded_iterations=30 cleanup=complete\n'
diff --git a/.oat/projects/shared/session-evidence-followups/implementation.md b/.oat/projects/shared/session-evidence-followups/implementation.md
index e7fdfe3f..b244e8f1 100644
--- a/.oat/projects/shared/session-evidence-followups/implementation.md
+++ b/.oat/projects/shared/session-evidence-followups/implementation.md
@@ -1,30 +1,30 @@
 ---
 oat_status: in_progress
 oat_ready_for: null
 oat_blockers: []
 oat_last_updated: 2026-09-20
-oat_current_task_id: p01-t01
+oat_current_task_id: p02-t01
 oat_generated: false
 ---
 
 # Implementation: session-evidence-followups
 
 ## Progress Overview
 
 | Phase | Status  | Tasks | Completed |
 | ----- | ------- | ----- | --------- |
 | p00   | complete | 1     | 1/1       |
-| p01   | pending | 2     | 0/2       |
+| p01   | review | 2     | 2/2       |
 | p02   | pending | 2     | 0/2       |
 | p03   | pending | 1     | 0/1       |
 | p04   | pending | 1     | 0/1       |
 
-**Total:** 1/7 tasks completed.
+**Total:** 3/7 tasks completed.
 
 ## Orchestration Runs
 
 ### Run 1 — 2026-09-20
 
 One branch/PR: backlog-review-2026-09-20. Native Sol phase implementation, user-selected Opus through Consensus Review. High ceiling, no parallel product phases because shared generated payload/version ownership overlaps. Read-only recon ran concurrently. IMPLEMENT-03: final checkpoint p04, autonomous continuation authorized by user. Additional requested timeout adjustment executes first as p00.
 
 ### p00 — completed
@@ -36,16 +36,30 @@ Request `evidence-p00-20260920`; native `/root/p00_timeout` accepted and complet
 Base `f7298f35195ff305ec2d223f3873845444dc2317`; task commit `852be12cf67f5231f481dd97ce741e057d841937`; self-review passed. Root verified bounded files and clean worktree. Recovery attempts 0. No nested workers.
 
 Independent Consensus Review requested `claude:opus --effort high`, run `8c84e955-3f2e-4817-afd8-a7d08531875b`, passed with 0 Critical/High, one Medium and one Low. [Canonical review](reviews/p00-opus-review.md) is preserved unchanged. Consensus replaces the OAT-native reviewer contract by user selection; its own validated structured envelope supplies provenance, and no OAT reconnaissance claim is fabricated. Requested model/effort are configured controls; wrapper reports actual model/effort unobserved.
 
 Disposition: M1 accepted as host-budget documentation guidance; same native handle continued as `evidence-p00-fix1-20260920`, commit `37f2832f387c1b5559a32c40396b1d92013b0fa9`, root inspected the exact docs-only diff. L1 declined: default dispatch assertion already fails meaningfully and duplicating the test adds no coverage. Reviewer question about why 900 seconds: explicit user-selected budget after observed 600-second cutoff, not a claimed latency percentile. No further review needed for this bounded nonblocking documentation clarification; final integration review still covers it.
 
 Validation: focused run.test.ts 25/25, type-check, build, build:check, scoped lint/format, skill-version validation from baseline, documentation production build and diff check passed. Docs follow-up repeated build freshness, scoped format, version validation, production docs build and self-review. Global installs remain unchanged until merge.
 
+### p01 — implemented, independent review pending
+
+Request `evidence-p01-20260920`, native `/root/p01_watcher` accepted/completed as `oat-phase-implementer-gpt-5-6-sol-high`; High policy, hard-reasoning class, high effort for cross-runtime signal and checkpoint semantics; candidates Sol medium/high, high selected. No nested workers, recovery 0/10.
+
+`Dispatch: scope=p01 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`
+
+Base `73e1752b57e03878a908f506622142a5115b41e2`; p01-t01 `c1b68367b3cb143654f095e308b3f1cc81ba4788`; p01-t02 `83b36bf602c26a7309ed1e2b6e173ccf83a0798a`. Root verified exactly two in-scope task commits and clean worktree. Self-review passed. Observer 1.0.73, collab 1.0.61, export 2.0.24 and fork 0.2.38 include required transitive version closure.
+
+Verification: watcher 60/60; shared terminal/activity 32/32; full collaboration directory 199/199 across 13 files; typecheck, build/freshness, baseline skill versions, validate, scoped lint/format, diffcheck and docs production build (58 pages) passed. Claude watch integration checks pre-checkpoint pointer join, explicit-abort suppression and body omission. Subprocess audit: comparable cleanup tests wait for ownership/startup; max-runtime tests use virtual clocks or intentionally test timeout behavior, so no matching fixed-lifetime event-count race remains.
+
+Final-tree stress: [log](evidence/p01-final-stress.log), [temporary harness retained as evidence](evidence/p01-stress-harness.sh). Exactly 50 consecutive passes, 30 loaded iterations (11–40), clean process teardown. Root independently checked sequence/count and SHA256 `e3b9a6ad30da3f00d02c65b2c2d5db71daa7fcd6a3e348c1f67a8a7fa44b1e82`. Initial test-only log also passed 50/50, but final acceptance uses the final-tree evidence. Three fixing-PR validate successes still pending; no ticket closed.
+
+Review routing: exact Opus reviewer under High policy, `--effort high` user-selected Consensus route. The base-branch selector's 2 MiB whole-file snapshot cap is exceeded by duplicated generated bundles. Preserve authored before/after diff including deletions, immutable base/head and hashes of every changed file in a bounded external review packet; verify generated units with build:check and version validation. Keep entire checkout stable. This changes review transport only, not review scope or acceptance requirements; final review uses the same method if needed.
+
 ## Implementation Log
 
 - Plan committed and reviewed; initial response-format failures preserved as diagnostics, not passes. Valid review found one High native retry-grammar issue; bounded fix verification passed with zero findings.
 - Root complexity pass complete, no material runtime simplification required. Baseline generated-output freshness passed.
 - Task-specific evidence and commits will be recorded here after each child returns. Root does not mutate the checkout while a child owns implementation or while Consensus reviews it.
 
 ## Deviations from Plan / Design
 
@@ -57,16 +71,16 @@ Validation: focused run.test.ts 25/25, type-check, build, build:check, scoped li
 ## Test Results
 
 | Scope    | Command              | Result                                                 |
 | -------- | -------------------- | ------------------------------------------------------ |
 | Baseline | pnpm run build:check | Passed; /tmp/session-evidence-baseline-build-check.log |
 
 ## Final Summary (for PR/docs)
 
-p00 completed: Consensus Review defaults to 900 seconds with explicit internal overrides preserved. Six backlog tasks remain; no tickets closed and no PR exists yet.
+p00 completed: Consensus Review defaults to 900 seconds with explicit internal overrides preserved. p01 implements reliable rearm testing and metadata-only unsuccessful terminal signals across Claude, Codex and Cursor. Four backlog tasks remain; no tickets closed and no PR exists yet.
 
 ## References
 
 - [Plan](plan.md)
 - [Discovery](discovery.md)
 - [Review dispositions](reviews/plan-review-disposition.md)
 - [Complexity review](reviews/complexity-review.md)
diff --git a/.oat/projects/shared/session-evidence-followups/plan.md b/.oat/projects/shared/session-evidence-followups/plan.md
index d25818fa..56cecd7f 100644
--- a/.oat/projects/shared/session-evidence-followups/plan.md
+++ b/.oat/projects/shared/session-evidence-followups/plan.md
@@ -166,17 +166,17 @@ Close each fully satisfied item via repo Backlog Lifecycle: status/updated, comp
 | p04    | code     | pending         | -          | -                             | -             | -          | -           |
 | plan | artifact | passed | 2026-09-20 | reviews/plan-opus-h1-verification.md | 6863c882 | manual | claude:opus |
 | p00 | code | passed | 2026-09-20 | reviews/p00-opus-review.md | - | manual | - |
 
 Spec/design rows are retained template history; quick mode uses discovery and this plan only. Full reviewed plan plus the clean bounded H1 verification establish readiness. [Complexity review](reviews/complexity-review.md) retains the minimum sufficient approach. The subsequently user-requested 600→900 timeout task is a narrow operational addition; its requirements are explicit above and it receives self-review and independent Opus code review, without repeating the unchanged six-ticket plan review.
 
 ## Implementation Complete
 
-Phase 0 complete. Phase 0: 1 task; Phase 1: 2 tasks; Phase 2: 2 tasks; Phase 3: 1 task; Phase 4: 1 task. **Total: 7 tasks, 1 complete.** Final acceptance/delivery remains mandatory after product phases.
+Phases 0–1 implemented; p01 review pending. Phase 0: 1 task; Phase 1: 2 tasks; Phase 2: 2 tasks; Phase 3: 1 task; Phase 4: 1 task. **Total: 7 tasks, 3 complete.** Final acceptance/delivery remains mandatory after product phases.
 
 ## References
 
 - [Discovery](discovery.md)
 - [Backlog review](../../../repo/pjm/backlog/reviews/backlog-and-roadmap-review.md)
 - Native schemas: `documentation/docs/engineering/architecture/session-schemas/`
 - Retained structure research: `.oat/repo/reference/research/session-schemas-2026-09-18/`
 - [BL-260919-stabilize-the-watcher-sigterm](../../../repo/pjm/backlog/items/BL-260919-stabilize-the-watcher-sigterm.md)
diff --git a/.oat/projects/shared/session-evidence-followups/state.md b/.oat/projects/shared/session-evidence-followups/state.md
index 11835fd7..ecbc89ad 100644
--- a/.oat/projects/shared/session-evidence-followups/state.md
+++ b/.oat/projects/shared/session-evidence-followups/state.md
@@ -1,11 +1,11 @@
 ---
-oat_current_task: p01-t01
-oat_last_commit: 37f2832f387c1b5559a32c40396b1d92013b0fa9
+oat_current_task: p02-t01
+oat_last_commit: 83b36bf602c26a7309ed1e2b6e173ccf83a0798a
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
 oat_pr_status: null # null | ready | open | closed | merged — actual PR state for the current project
 oat_pr_url: null # null | string — tracked PR URL when a PR exists
 oat_project_created: '2026-09-20T19:09:21.094Z' # ISO 8601 UTC timestamp — set once at project creation
 oat_project_completed: null # ISO 8601 UTC timestamp — set when project is completed/archived
-oat_project_state_updated: '2026-09-20T21:00:50.915632+00:00'
+oat_project_state_updated: '2026-09-20T21:35:02.144308+00:00'
 oat_dispatch_policy:
   mode: managed
   policy: high
   source: project-state
 oat_skill_gate_overrides:
   oat-project-quick-start: disabled
   oat-project-implement: disabled
 oat_generated: false
@@ -99,37 +99,37 @@ oat_generated: false
 # Project State: session-evidence-followups
 
 **Status:** Implementation
 **Started:** 2026-09-20
 **Last Updated:** 2026-09-20
 
 ## Current Phase
 
-p00 complete and independently reviewed. Next p01-t01, then p01-t02 through p04; user authorized continuation to one mergeable PR.
+p00 complete and independently reviewed. p01 implementation complete, independent review pending before p02 dispatch. User authorized continuation through one mergeable PR.
 
 ## Artifacts
 
 - **Discovery:** `discovery.md` (complete)
 - **Spec:** N/A (quick mode)
 - **Design:** N/A (quick mode unless lightweight design is needed)
 - **Plan:** `plan.md` (complete and reviewed)
-- **Implementation:** `implementation.md` (1/7 tasks complete)
+- **Implementation:** `implementation.md` (3/7 tasks complete)
 
 ## Progress
 
 - ✓ Discovery complete
 - ✓ Execution artifacts scaffolded
 - ✓ Plan Opus review and complexity pass complete
 - ✓ p00 timeout implemented and independently reviewed
-- ⧗ p01 watcher implementation next
+- ⧗ p01 watcher independent review
 
 ## Blockers
 
 None
 
 ## Next Milestone
 
-Complete p01 watcher reliability and terminal events
+Review p01, open progress PR for CI proof, then implement p02
 
 ## Review routing for this authorized run
 
 User selected Opus via Consensus Review for plan, phase and final reviews. Project-local lifecycle gate overrides prevent duplicate configured reviews; they do not claim a disabled gate passed. This run still requires the user-selected independent reviews. Shared/user gate configuration is unchanged. IMPLEMENT-03 resolves the final phase checkpoint to p04; user authorized continuing through delivery without intermediate pauses. Post-implementation sequence resolved from shared config: summary, document, PR; postApproval empty. No merge authorization.
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 972fce3b..d4dda1c8 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,14 +1,22 @@
 # Changelog
 
 ## [Unreleased]
 
 ### Added
 
+- `session-observer` 1.0.73 reports metadata-only unsuccessful terminal turns
+  from native Claude Code, Codex, and Cursor lifecycle evidence while preserving
+  exact-range checkpoint deduplication and keeping terminal events visible under
+  `--quiet-empty`. `session-observer-collab` 1.0.61 proves those events do not
+  create peer-message authority; `session-export-transcript` 2.0.24 and
+  `session-fork-to-destination` 0.2.38 receive the shared transcript decoder
+  closure without changing their user-facing behavior.
+
 - `session-observer-collab` 1.0.45 completes the finite Claude Monitor's
   critical-path fixture proof across shared-cap exhaustion, lifecycle changes,
   identity and continuity failures, private no-op progress, concurrent runners,
   interrupted event/slot/output stages, real Claude transcript digestion, and
   Codex, Claude Code, and Cursor peers without public-offset mutation.
 
 - `agent-messaging` 1.0.13 and `session-observer-collab` 1.0.37 add the
   fixture-tested finite Claude composed Monitor: exact activation and peer pins,
@@ -96,16 +104,22 @@
 - Documentation site retheme (dark terminal-serif palette with a derived light mode, site-palette Mermaid, accessible horizontally scrollable diagrams, base-path-safe images) and a Markdown & Visuals catalog with copyable syntax and rendered examples.
 - Twelve source-verified diagrams across the User Guide and Engineering pages, three with hand-authored SVG counterparts (source-to-distribution, peers-not-personas, provider process boundary).
 - Engineering guides: TypeScript & Build Tooling, Testing, Consensus Runtime, CI & Quality Gates, Releases & Versioning; User Guide reorganized into Getting Started, Plugins (Consensus, Session), and capability-grouped Standalone Skills, with the README as a task-oriented entry point.
 - `defaults.peers` model and effort now reach dispatch in Create, Decide, Plan, Refine, and Evaluate (`create`/`decide`/`plan` 0.1.10, `refine` 0.1.13, `evaluate` 0.1.14); peer agents travel to the standalone loop as JSON (`--peer-agents`) so model IDs may contain delimiters, and the configuration page's model/effort limitation is removed.
 - Deterministic observer re-arm tests covering SIGTERM, control-stop, max-runtime expiry, filtered-only ranges, startup appends, and competing consumers (`session-observer` 1.0.41); the Claude Code collaboration reference now records live Monitor evidence, the 30-minute cap, the re-arm gap read, and an explicit worktree handback rule (`session-observer-collab` 1.0.30).
 
 ### Changed
 
+- `session-observer` 1.0.72 makes the SIGTERM re-arm regression wait for the
+  exact delivered delta and durable checkpoint before a clean second shutdown,
+  removing its fixed 120 ms subprocess lifetime assumption;
+  `session-observer-collab` 1.0.60 and `session-fork-to-destination` 0.2.37
+  receive the required observer-owner version closure without behavior changes.
+
 - `consensus-review` 0.1.14 gives each review provider invocation a 15-minute
   wall-clock runtime by default while preserving internal caller overrides and
   documenting host execution budgets.
 
 - `agent-messaging` 1.0.15 and `session-observer-collab` 1.0.39 share Claude
   hook inventory and automatic-owner assessment from the canonical
   collaboration runtime instead of bundling those read-only primitives from a
   sibling skill.
diff --git a/documentation/docs/user-guide/skills/session-observer.md b/documentation/docs/user-guide/skills/session-observer.md
index 1c570274..4a57d6c4 100644
--- a/documentation/docs/user-guide/skills/session-observer.md
+++ b/documentation/docs/user-guide/skills/session-observer.md
@@ -165,26 +165,55 @@ flowchart TD
 
 The collaboration skill composes with this CLI; it does not replace it. These
 flags are the base observer's collaboration-facing contract:
 
 | Flag or command                                  | Purpose                                                                                                                                                                                                                         |
 | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 | `whoami --json`                                  | Resolve and print this session's runtime, session ID, transcript path, and identity source before a peer is pinned.                                                                                                             |
 | `--session <runtime>:<id>`                       | Pin every stateful read or watch to one exact peer identity.                                                                                                                                                                    |
-| `--quiet-empty`                                  | Consume metadata-only growth and advance the offset without printing an empty delta.                                                                                                                                            |
+| `--quiet-empty`                                  | Consume filtered growth and advance the offset without printing an empty delta; terminal lifecycle events remain visible.                                                                                                       |
 | `--strict-baseline`                              | Refuse a standalone watch that would skip previously unread records; use `catch-up-then-watch` when you need to consume that backlog first.                                                                                     |
 | `--event-log <path>`                             | Write metadata-only watch events under the observer state directory; message content remains on stdout.                                                                                                                         |
 | `--include-tools` / `--include-command-messages` | Expand a digest for bounded debugging; these are opt-in and do not change the default tool-free view. On Claude Code and Codex, `--include-tools` also adds option descriptions to ask-user questions, which render either way. |
 
-Watch output can report `baseline-gap`, `newer-session-candidate`, terminal
-diagnostics, or automatic control input. A newer-session candidate is a warning,
-not permission to switch pins. A filtered or empty digest is not evidence that
-the peer was idle; inspect the digest's declared schema, index base, and
-accounting or run a pinned review.
+Watch output can report `baseline-gap`, `newer-session-candidate`, `terminal`,
+or automatic control input. A newer-session candidate is a warning, not
+permission to switch pins. A filtered or empty digest is not evidence that the
+peer was idle; inspect the digest's declared schema, index base, and accounting
+or run a pinned review.
+
+## Unsuccessful terminal events
+
+A `terminal` watch event reports a natively recorded unsuccessful turn without
+copying the transcript body or provider error message. Its source locator
+belongs to the exact consumed record or frame range. Terminal-only growth still
+advances the checkpoint and is delivered at most once; `--quiet-empty`
+suppresses only an empty `delta`, never the terminal event. A later successful
+record does not erase an earlier terminal event. Terminal metadata is evidence
+about peer lifecycle, not a peer-authored message or authority to send or
+continue collaboration work.
+
+Runtime evidence is intentionally narrow:
+
+- Claude Code accepts explicit assistant API-error, aborted-mid-stream, and
+  truncated flags in that precedence order. A newly consumed user interruption
+  pointer may join an earlier same-session assistant from the captured
+  transcript, including before the checkpoint; it is suppressed when that
+  assistant already has an explicit abort. Tool failures, denial fields, stop
+  reasons, arbitrary error prose, orphan pointers, and cross-session pointers
+  do not qualify.
+- Codex accepts native `task_complete` records with an error object and
+  `turn_aborted` records. A `usage_limit_exceeded` message may contribute only a
+  validated trailing English `try again at ...` clock or calendar fragment
+  with `inferred-from-error-message` provenance. The fragment is not normalized
+  into an absolute instant, and other error text is omitted.
+- Cursor accepts native error, aborted, and cancelled `turn_ended` frames.
+  Cursor does not expose per-call terminal results here, and terminal error
+  bodies are omitted.
 
 ## Re-arm an exact pinned watcher
 
 When a watcher expires or stops, keep the exact `<runtime>:<session-id>` pin.
 Stop the old watcher, confirm it is gone, then start one replacement with
 `catch-up-then-watch`:
 
 ```bash
diff --git a/src/shared/transcript/activity/codex.ts b/src/shared/transcript/activity/codex.ts
index 0a0ef8b6..6be8dbae 100644
--- a/src/shared/transcript/activity/codex.ts
+++ b/src/shared/transcript/activity/codex.ts
@@ -1,9 +1,10 @@
 import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
+import { decodeCodexLifecycleRecord } from '../terminal-events.js';
 import {
   eventKey,
   isJsonObject,
   numberValue,
   outcomeFromStatus,
   recordLocator,
   stringValue,
 } from './types.js';
@@ -174,37 +175,20 @@ function selectedLifecycleMetadata(payload: JsonObject): JsonObject {
   );
 }
 
 function codexLifecycleActivity(
   source: ActivitySource,
   detailed: DetailedTranscriptRecord,
   payload: JsonObject,
 ): ExtractedRecordActivity | undefined {
-  const nativeType = stringValue(payload.type);
-  if (
-    nativeType !== 'task_started' &&
-    nativeType !== 'task_complete' &&
-    nativeType !== 'turn_aborted'
-  ) {
-    return undefined;
-  }
+  const lifecycle = decodeCodexLifecycleRecord(detailed);
+  if (!lifecycle) return undefined;
+  const { nativeType, outcome, turnId, nativeStatus, errorInfo } = lifecycle;
   const locator = recordLocator(detailed, '/payload');
-  const turnId = stringValue(payload.turn_id);
-  const nativeStatus = stringValue(payload.status);
-  const error = isJsonObject(payload.error) ? payload.error : undefined;
-  const outcome: ActivityOutcome =
-    nativeType === 'task_started'
-      ? 'pending'
-      : nativeType === 'turn_aborted'
-        ? 'cancelled'
-        : error
-          ? 'error'
-          : 'success';
-  const errorInfo = error ? stringValue(error.codex_error_info) : undefined;
   const metadata = selectedLifecycleMetadata(payload);
   if (errorInfo !== undefined) metadata.errorInfo = errorInfo;
   return {
     events: [
       {
         eventKey: eventKey(source, locator),
         kind: 'lifecycle',
         nativeType,
diff --git a/src/shared/transcript/terminal-events.test.ts b/src/shared/transcript/terminal-events.test.ts
new file mode 100644
index 00000000..e35674b9
--- /dev/null
+++ b/src/shared/transcript/terminal-events.test.ts
@@ -0,0 +1,388 @@
+import { describe, expect, it } from 'vitest';
+
+import type {
+  CursorTranscriptAnalysis,
+  CursorTurnAnalysis,
+} from './cursor-analysis.js';
+import type {
+  DetailedTranscriptRead,
+  DetailedTranscriptRecord,
+  JsonObject,
+} from './runtimes.js';
+import {
+  codexRetryEvidenceFragment,
+  decodeCodexLifecycleRecord,
+  extractCursorTerminalEvents,
+  extractRecordedTerminalEvents,
+} from './terminal-events.js';
+
+function detailed(
+  record: JsonObject,
+  recordIndex: number,
+): DetailedTranscriptRecord {
+  return {
+    record,
+    recordIndex,
+    physicalLine: recordIndex + 1,
+    sourceCarrier: JSON.stringify(record),
+  };
+}
+
+function read(records: JsonObject[]): DetailedTranscriptRead {
+  return {
+    records: records.map(detailed),
+    diagnostics: [],
+    capturedAt: '2026-09-20T12:00:00.000Z',
+    sourceBytes: 1,
+  };
+}
+
+function codexEvents(records: JsonObject[], fromIndex = 0) {
+  return extractRecordedTerminalEvents({
+    runtime: 'codex',
+    sessionId: 'codex-session',
+    nativeSessionId: 'codex-native-session',
+    read: read(records),
+    fromIndex,
+    nextIndex: records.length,
+  });
+}
+
+function claudeEvents(records: JsonObject[], fromIndex = 0) {
+  return extractRecordedTerminalEvents({
+    runtime: 'claude-code',
+    sessionId: 'claude-session',
+    nativeSessionId: 'claude-native-session',
+    read: read(records),
+    fromIndex,
+    nextIndex: records.length,
+  });
+}
+
+describe('Codex terminal decoding', () => {
+  it('shares task lifecycle classification with activity and excludes success', () => {
+    const started = detailed(
+      { type: 'event_msg', payload: { type: 'task_started' } },
+      0,
+    );
+    const completed = detailed(
+      { type: 'event_msg', payload: { type: 'task_complete' } },
+      1,
+    );
+    const failed = detailed(
+      {
+        type: 'event_msg',
+        payload: {
+          type: 'task_complete',
+          error: { codex_error_info: 'response_too_large' },
+        },
+      },
+      2,
+    );
+    const aborted = detailed(
+      { type: 'event_msg', payload: { type: 'turn_aborted' } },
+      3,
+    );
+
+    expect(decodeCodexLifecycleRecord(started)?.outcome).toBe('pending');
+    expect(decodeCodexLifecycleRecord(completed)?.outcome).toBe('success');
+    expect(decodeCodexLifecycleRecord(failed)?.outcome).toBe('error');
+    expect(decodeCodexLifecycleRecord(aborted)?.outcome).toBe('cancelled');
+    expect(
+      codexEvents([
+        started.record,
+        completed.record,
+        failed.record,
+        aborted.record,
+      ]).map((event) => [event.nativeType, event.status]),
+    ).toEqual([
+      ['task_complete', 'error'],
+      ['turn_aborted', 'aborted'],
+    ]);
+  });
+
+  it('retains only verified usage-limit retry suffix fragments and provenance', () => {
+    const events = codexEvents([
+      {
+        type: 'event_msg',
+        payload: {
+          type: 'task_complete',
+          error: {
+            codex_error_info: 'usage_limit_exceeded',
+            message: 'Provider limit; try again at Sep 19th, 2026 5:01 AM.',
+          },
+        },
+      },
+      {
+        type: 'event_msg',
+        payload: {
+          type: 'task_complete',
+          error: {
+            codex_error_info: 'usage_limit_exceeded',
+            message: 'Provider limit; try again at 9:30 AM.',
+          },
+        },
+      },
+    ]);
+
+    expect(events).toEqual([
+      expect.objectContaining({
+        nativeErrorCode: 'usage_limit_exceeded',
+        retryEvidence: {
+          fragment: 'Sep 19th, 2026 5:01 AM',
+          provenance: 'inferred-from-error-message',
+          source: {
+            indexBase: 'zero-based-jsonl-record-index',
+            recordIndex: 0,
+            physicalLine: 1,
+            jsonPointer: '/payload/error/message',
+          },
+        },
+      }),
+      expect.objectContaining({
+        retryEvidence: expect.objectContaining({ fragment: '9:30 AM' }),
+      }),
+    ]);
+    expect(JSON.stringify(events)).not.toContain('Provider limit');
+  });
+
+  it.each([
+    ['wrong code', 'response_too_large', 'try again at 9:30 AM.'],
+    ['bad hour', 'usage_limit_exceeded', 'try again at 13:30 AM.'],
+    ['bad minute', 'usage_limit_exceeded', 'try again at 9:99 AM.'],
+    [
+      'bad date',
+      'usage_limit_exceeded',
+      'try again at Feb 30th, 2026 9:30 AM.',
+    ],
+    [
+      'bad ordinal',
+      'usage_limit_exceeded',
+      'try again at Sep 19st, 2026 9:30 AM.',
+    ],
+    ['trailing prose', 'usage_limit_exceeded', 'try again at 9:30 AM. Later.'],
+    ['no suffix', 'usage_limit_exceeded', 'usage limit reached'],
+  ])('rejects %s as retry evidence', (_name, code, message) => {
+    const [event] = codexEvents([
+      {
+        type: 'event_msg',
+        payload: {
+          type: 'task_complete',
+          error: { codex_error_info: code, message },
+        },
+      },
+    ]);
+    expect(event).not.toHaveProperty('retryEvidence');
+  });
+
+  it('accepts a valid bare calendar day without inventing an absolute instant', () => {
+    expect(
+      codexRetryEvidenceFragment(
+        'Limit punctuation varies: try again at Sep 19, 2026 5:01 AM.',
+      ),
+    ).toBe('Sep 19, 2026 5:01 AM');
+  });
+});
+
+describe('Claude Code terminal decoding', () => {
+  const assistant = (overrides: JsonObject): JsonObject => ({
+    type: 'assistant',
+    sessionId: 'claude-session',
+    message: { id: 'assistant-1', role: 'assistant', content: [] },
+    ...overrides,
+  });
+
+  it.each([
+    [{ isApiErrorMessage: true, apiErrorStatus: 429 }, 'api-error', 429],
+    [{ isAbortedMidStream: true }, 'aborted-mid-stream', undefined],
+    [{ truncatedAfterOutput: true }, 'truncated-after-output', undefined],
+  ])('emits the explicit assistant flag %#', (flags, status, errorCode) => {
+    const [event] = claudeEvents([assistant(flags)]);
+    expect(event).toMatchObject({
+      nativeType: 'assistant',
+      status,
+      source: { recordIndex: 0, physicalLine: 1 },
+    });
+    if (errorCode === undefined) {
+      expect(event).not.toHaveProperty('nativeErrorCode');
+    } else {
+      expect(event.nativeErrorCode).toBe(errorCode);
+    }
+  });
+
+  it('applies API error then abort then truncation precedence once per record', () => {
+    expect(
+      claudeEvents([
+        assistant({
+          isApiErrorMessage: true,
+          isAbortedMidStream: true,
+          truncatedAfterOutput: true,
+        }),
+        assistant({
+          message: { id: 'assistant-2', role: 'assistant', content: [] },
+          isAbortedMidStream: true,
+          truncatedAfterOutput: true,
+        }),
+      ]).map((event) => event.status),
+    ).toEqual(['api-error', 'aborted-mid-stream']);
+  });
+
+  it('ignores tool failures, error prose, stop reasons, and bare API status', () => {
+    expect(
+      claudeEvents([
+        assistant({ apiErrorStatus: 500, error: 'private body' }),
+        assistant({
+          message: {
+            id: 'assistant-2',
+            role: 'assistant',
+            stop_reason: 'error',
+          },
+        }),
+        {
+          type: 'user',
+          sessionId: 'claude-session',
+          message: {
+            role: 'user',
+            content: [
+              {
+                type: 'tool_result',
+                is_error: true,
+                content: 'private tool body',
+              },
+            ],
+          },
+          toolUseResult: { interrupted: true },
+          toolDenialKind: 'user-rejected',
+        },
+      ]),
+    ).toEqual([]);
+  });
+
+  it('joins a new interruption pointer to an earlier exact-session assistant', () => {
+    const records = [
+      assistant({}),
+      {
+        type: 'user',
+        sessionId: 'claude-session',
+        interruptedMessageId: 'assistant-1',
+        message: { role: 'user', content: [] },
+      },
+    ];
+    expect(claudeEvents(records, 1)).toEqual([
+      expect.objectContaining({
+        nativeType: 'user-interruption',
+        status: 'interrupted',
+        source: expect.objectContaining({
+          recordIndex: 1,
+          jsonPointer: '/interruptedMessageId',
+        }),
+      }),
+    ]);
+  });
+
+  it('suppresses explicit-abort duplicates and orphan or cross-session pointers', () => {
+    const records = [
+      assistant({ isAbortedMidStream: true }),
+      {
+        type: 'assistant',
+        sessionId: 'other-session',
+        message: { id: 'other-assistant', role: 'assistant', content: [] },
+      },
+      ...['assistant-1', 'missing', 'other-assistant'].map(
+        (interruptedMessageId) => ({
+          type: 'user',
+          sessionId: 'claude-session',
+          interruptedMessageId,
+          message: { role: 'user', content: [] },
+        }),
+      ),
+    ];
+    expect(claudeEvents(records, 2)).toEqual([]);
+  });
+
+  it('keeps a later recovery record from hiding the earlier failure', () => {
+    const events = claudeEvents([
+      assistant({ isApiErrorMessage: true, error: 'private failure body' }),
+      {
+        type: 'assistant',
+        sessionId: 'claude-session',
+        message: {
+          id: 'assistant-2',
+          role: 'assistant',
+          content: [{ type: 'text', text: 'later recovery body' }],
+        },
+      },
+    ]);
+    expect(events).toHaveLength(1);
+    expect(JSON.stringify(events)).not.toMatch(/private|recovery body/u);
+  });
+});
+
+describe('Cursor terminal decoding', () => {
+  function turn(
+    lifecycle: CursorTurnAnalysis['lifecycle'],
+    terminalFrameIndex: number,
+  ): CursorTurnAnalysis {
+    return {
+      turnId: `turn-${terminalFrameIndex}`,
+      fromFrameIndex: terminalFrameIndex - 1,
+      observedThroughFrame: terminalFrameIndex,
+      assistantRecords: [],
+      humanRecordIndexes: [],
+      toolRecordIndexes: [],
+      lifecycle,
+      terminalFrameIndex,
+      finalSubstantiveEntryKey: null,
+    };
+  }
+
+  const analysis: CursorTranscriptAnalysis = {
+    turns: [
+      turn('success', 1),
+      turn('error', 3),
+      turn('aborted', 5),
+      turn('cancelled', 7),
+    ],
+    metadataFrameIndexes: [],
+    blockingFrame: null,
+  };
+
+  it('emits frame-located error, aborted, and cancelled outcomes only', () => {
+    expect(
+      extractCursorTerminalEvents({
+        runtime: 'cursor',
+        sessionId: 'cursor-session',
+        nativeSessionId: 'cursor-session',
+        analysis,
+        fromIndex: 0,
+        nextIndex: 8,
+      }),
+    ).toEqual([
+      expect.objectContaining({
+        status: 'error',
+        source: expect.objectContaining({ frameIndex: 3, physicalLine: 4 }),
+      }),
+      expect.objectContaining({
+        status: 'aborted',
+        source: expect.objectContaining({ frameIndex: 5, physicalLine: 6 }),
+      }),
+      expect.objectContaining({
+        status: 'cancelled',
+        source: expect.objectContaining({ frameIndex: 7, physicalLine: 8 }),
+      }),
+    ]);
+  });
+
+  it('restricts events to the exact consumed frame range', () => {
+    expect(
+      extractCursorTerminalEvents({
+        runtime: 'cursor',
+        sessionId: 'cursor-session',
+        nativeSessionId: 'cursor-session',
+        analysis,
+        fromIndex: 4,
+        nextIndex: 7,
+      }).map((event) => event.status),
+    ).toEqual(['aborted']);
+  });
+});
diff --git a/src/shared/transcript/terminal-events.ts b/src/shared/transcript/terminal-events.ts
new file mode 100644
index 00000000..65161f95
--- /dev/null
+++ b/src/shared/transcript/terminal-events.ts
@@ -0,0 +1,385 @@
+import type { CursorTranscriptAnalysis } from './cursor-analysis.js';
+import type {
+  DetailedTranscriptRead,
+  DetailedTranscriptRecord,
+  JsonObject,
+  Runtime,
+} from './runtimes.js';
+
+export type UnsuccessfulTerminalStatus =
+  | 'api-error'
+  | 'aborted-mid-stream'
+  | 'truncated-after-output'
+  | 'interrupted'
+  | 'error'
+  | 'aborted'
+  | 'cancelled';
+
+export interface TerminalRecordLocator {
+  indexBase: 'zero-based-jsonl-record-index' | 'zero-based-jsonl-frame-index';
+  physicalLine: number;
+  jsonPointer: string;
+  recordIndex?: number;
+  frameIndex?: number;
+}
+
+export interface TerminalRetryEvidence {
+  fragment: string;
+  provenance: 'inferred-from-error-message';
+  source: TerminalRecordLocator;
+}
+
+export interface UnsuccessfulTerminalEvent {
+  type: 'terminal';
+  runtime: Runtime;
+  sessionId: string;
+  nativeSessionId: string;
+  nativeType:
+    | 'task_complete'
+    | 'turn_aborted'
+    | 'assistant'
+    | 'user-interruption'
+    | 'turn_ended';
+  status: UnsuccessfulTerminalStatus;
+  source: TerminalRecordLocator;
+  nativeErrorCode?: string | number;
+  retryEvidence?: TerminalRetryEvidence;
+}
+
+export interface CodexLifecycleSignal {
+  nativeType: 'task_started' | 'task_complete' | 'turn_aborted';
+  outcome: 'pending' | 'success' | 'error' | 'cancelled';
+  turnId?: string;
+  nativeStatus?: string;
+  errorInfo?: string;
+  errorMessage?: string;
+}
+
+interface ExactTerminalSource {
+  runtime: Exclude<Runtime, 'cursor'>;
+  sessionId: string;
+  nativeSessionId: string;
+  read: DetailedTranscriptRead;
+  fromIndex: number;
+  nextIndex: number;
+}
+
+interface CursorTerminalSource {
+  runtime: 'cursor';
+  sessionId: string;
+  nativeSessionId: string;
+  analysis: CursorTranscriptAnalysis;
+  fromIndex: number;
+  nextIndex: number;
+}
+
+const MONTH_INDEX = new Map(
+  [
+    'Jan',
+    'Feb',
+    'Mar',
+    'Apr',
+    'May',
+    'Jun',
+    'Jul',
+    'Aug',
+    'Sep',
+    'Oct',
+    'Nov',
+    'Dec',
+  ].map((month, index) => [month.toLowerCase(), index]),
+);
+
+const RETRY_SUFFIX =
+  /try again at ((?:([A-Z][a-z]{2}) (\d{1,2})(st|nd|rd|th)?, (\d{4}) )?(\d{1,2}):(\d{2}) (AM|PM))\.$/iu;
+
+function isJsonObject(value: unknown): value is JsonObject {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
+
+function stringValue(value: unknown): string | undefined {
+  return typeof value === 'string' ? value : undefined;
+}
+
+function expectedOrdinal(day: number): string {
+  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
+  switch (day % 10) {
+    case 1:
+      return 'st';
+    case 2:
+      return 'nd';
+    case 3:
+      return 'rd';
+    default:
+      return 'th';
+  }
+}
+
+function validCalendarDate(
+  month: string,
+  dayText: string,
+  ordinal: string | undefined,
+  yearText: string,
+): boolean {
+  const monthIndex = MONTH_INDEX.get(month.toLowerCase());
+  const day = Number(dayText);
+  const year = Number(yearText);
+  if (monthIndex === undefined || !Number.isInteger(day) || day < 1) {
+    return false;
+  }
+  if (ordinal && ordinal.toLowerCase() !== expectedOrdinal(day)) return false;
+  const date = new Date(Date.UTC(year, monthIndex, day));
+  return (
+    date.getUTCFullYear() === year &&
+    date.getUTCMonth() === monthIndex &&
+    date.getUTCDate() === day
+  );
+}
+
+export function codexRetryEvidenceFragment(
+  message: string,
+): string | undefined {
+  const match = RETRY_SUFFIX.exec(message);
+  if (!match) return;
+  const hour = Number(match[6]);
+  const minute = Number(match[7]);
+  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return;
+  if (
+    match[2] !== undefined &&
+    !validCalendarDate(match[2], match[3]!, match[4], match[5]!)
+  ) {
+    return;
+  }
+  return match[1];
+}
+
+export function decodeCodexLifecycleRecord(
+  detailed: DetailedTranscriptRecord,
+): CodexLifecycleSignal | null {
+  const { record } = detailed;
+  if (record.type !== 'event_msg' || !isJsonObject(record.payload)) return null;
+  const payload = record.payload;
+  const nativeType = stringValue(payload.type);
+  if (
+    nativeType !== 'task_started' &&
+    nativeType !== 'task_complete' &&
+    nativeType !== 'turn_aborted'
+  ) {
+    return null;
+  }
+  const error = isJsonObject(payload.error) ? payload.error : undefined;
+  const outcome =
+    nativeType === 'task_started'
+      ? ('pending' as const)
+      : nativeType === 'turn_aborted'
+        ? ('cancelled' as const)
+        : error
+          ? ('error' as const)
+          : ('success' as const);
+  return {
+    nativeType,
+    outcome,
+    ...(stringValue(payload.turn_id) === undefined
+      ? {}
+      : { turnId: stringValue(payload.turn_id) }),
+    ...(stringValue(payload.status) === undefined
+      ? {}
+      : { nativeStatus: stringValue(payload.status) }),
+    ...(error && stringValue(error.codex_error_info) !== undefined
+      ? { errorInfo: stringValue(error.codex_error_info) }
+      : {}),
+    ...(error && stringValue(error.message) !== undefined
+      ? { errorMessage: stringValue(error.message) }
+      : {}),
+  };
+}
+
+function recordLocator(
+  detailed: DetailedTranscriptRecord,
+  jsonPointer: string,
+): TerminalRecordLocator {
+  return {
+    indexBase: 'zero-based-jsonl-record-index',
+    recordIndex: detailed.recordIndex,
+    physicalLine: detailed.physicalLine,
+    jsonPointer,
+  };
+}
+
+function codexTerminalEvent(
+  source: ExactTerminalSource,
+  detailed: DetailedTranscriptRecord,
+): UnsuccessfulTerminalEvent | null {
+  const lifecycle = decodeCodexLifecycleRecord(detailed);
+  if (
+    lifecycle === null ||
+    (lifecycle.nativeType === 'task_complete' &&
+      lifecycle.outcome !== 'error') ||
+    lifecycle.nativeType === 'task_started'
+  ) {
+    return null;
+  }
+  const event: UnsuccessfulTerminalEvent = {
+    type: 'terminal',
+    runtime: 'codex',
+    sessionId: source.sessionId,
+    nativeSessionId: source.nativeSessionId,
+    nativeType: lifecycle.nativeType,
+    status: lifecycle.nativeType === 'turn_aborted' ? 'aborted' : 'error',
+    source: recordLocator(detailed, '/payload'),
+    ...(lifecycle.errorInfo === undefined
+      ? {}
+      : { nativeErrorCode: lifecycle.errorInfo }),
+  };
+  if (
+    lifecycle.nativeType === 'task_complete' &&
+    lifecycle.errorInfo === 'usage_limit_exceeded' &&
+    lifecycle.errorMessage !== undefined
+  ) {
+    const fragment = codexRetryEvidenceFragment(lifecycle.errorMessage);
+    if (fragment !== undefined) {
+      event.retryEvidence = {
+        fragment,
+        provenance: 'inferred-from-error-message',
+        source: recordLocator(detailed, '/payload/error/message'),
+      };
+    }
+  }
+  return event;
+}
+
+function claudeAssistantStatus(
+  record: JsonObject,
+): UnsuccessfulTerminalStatus | null {
+  if (record.isApiErrorMessage === true) return 'api-error';
+  if (record.isAbortedMidStream === true) return 'aborted-mid-stream';
+  if (record.truncatedAfterOutput === true) return 'truncated-after-output';
+  return null;
+}
+
+function claudeSessionId(record: JsonObject): string | undefined {
+  return stringValue(record.sessionId);
+}
+
+function claudeTerminalEvents(
+  source: ExactTerminalSource,
+): UnsuccessfulTerminalEvent[] {
+  const assistants = new Map<
+    string,
+    {
+      detailed: DetailedTranscriptRecord;
+      status: UnsuccessfulTerminalStatus | null;
+    }
+  >();
+  for (const detailed of source.read.records) {
+    const { record } = detailed;
+    if (claudeSessionId(record) !== source.sessionId) continue;
+    const message = isJsonObject(record.message) ? record.message : undefined;
+    if (message?.role !== 'assistant') continue;
+    const messageId = stringValue(message.id);
+    if (!messageId) continue;
+    assistants.set(messageId, {
+      detailed,
+      status: claudeAssistantStatus(record),
+    });
+  }
+
+  return source.read.records.flatMap(
+    (detailed): UnsuccessfulTerminalEvent[] => {
+      if (
+        detailed.recordIndex < source.fromIndex ||
+        detailed.recordIndex >= source.nextIndex
+      ) {
+        return [];
+      }
+      const { record } = detailed;
+      if (claudeSessionId(record) !== source.sessionId) return [];
+      const message = isJsonObject(record.message) ? record.message : undefined;
+      const status = claudeAssistantStatus(record);
+      if (message?.role === 'assistant' && status !== null) {
+        const apiErrorStatus = record.apiErrorStatus;
+        return [
+          {
+            type: 'terminal' as const,
+            runtime: 'claude-code' as const,
+            sessionId: source.sessionId,
+            nativeSessionId: source.nativeSessionId,
+            nativeType: 'assistant' as const,
+            status,
+            source: recordLocator(detailed, ''),
+            ...(status === 'api-error' &&
+            typeof apiErrorStatus === 'number' &&
+            Number.isFinite(apiErrorStatus)
+              ? { nativeErrorCode: apiErrorStatus }
+              : {}),
+          },
+        ];
+      }
+
+      if (message?.role !== 'user') return [];
+      const interruptedMessageId = stringValue(record.interruptedMessageId);
+      if (!interruptedMessageId) return [];
+      const target = assistants.get(interruptedMessageId);
+      if (!target || target.status === 'aborted-mid-stream') return [];
+      return [
+        {
+          type: 'terminal' as const,
+          runtime: 'claude-code' as const,
+          sessionId: source.sessionId,
+          nativeSessionId: source.nativeSessionId,
+          nativeType: 'user-interruption' as const,
+          status: 'interrupted' as const,
+          source: recordLocator(detailed, '/interruptedMessageId'),
+        },
+      ];
+    },
+  );
+}
+
+export function extractRecordedTerminalEvents(
+  source: ExactTerminalSource,
+): UnsuccessfulTerminalEvent[] {
+  if (source.runtime === 'claude-code') return claudeTerminalEvents(source);
+  return source.read.records.flatMap((detailed) => {
+    if (
+      detailed.recordIndex < source.fromIndex ||
+      detailed.recordIndex >= source.nextIndex
+    ) {
+      return [];
+    }
+    const event = codexTerminalEvent(source, detailed);
+    return event ? [event] : [];
+  });
+}
+
+export function extractCursorTerminalEvents(
+  source: CursorTerminalSource,
+): UnsuccessfulTerminalEvent[] {
+  return source.analysis.turns.flatMap((turn) => {
+    const frameIndex = turn.terminalFrameIndex;
+    if (
+      frameIndex === null ||
+      frameIndex < source.fromIndex ||
+      frameIndex >= source.nextIndex ||
+      !['error', 'aborted', 'cancelled'].includes(turn.lifecycle)
+    ) {
+      return [];
+    }
+    return [
+      {
+        type: 'terminal' as const,
+        runtime: 'cursor' as const,
+        sessionId: source.sessionId,
+        nativeSessionId: source.nativeSessionId,
+        nativeType: 'turn_ended' as const,
+        status: turn.lifecycle as 'error' | 'aborted' | 'cancelled',
+        source: {
+          indexBase: 'zero-based-jsonl-frame-index' as const,
+          frameIndex,
+          physicalLine: frameIndex + 1,
+          jsonPointer: '/status',
+        },
+      },
+    ];
+  });
+}
diff --git a/src/skills/session-export-transcript/SKILL.md b/src/skills/session-export-transcript/SKILL.md
index e3cbd985..3db955f1 100644
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
-  version: '2.0.23'
+  version: '2.0.24'
 ---
 
 # {{distribution.name}}
 
 Exports the **current** conversation (yours — Claude Code, Codex, or Cursor) to a
 sanitized Markdown transcript, named after the current git branch, written by
 default to `~/Downloads`. Tool calls, tool results, system/developer instructions,
 environment/AGENTS.md/skill payloads, subagent notifications, automatic-control
diff --git a/src/skills/session-fork-to-destination/SKILL.md b/src/skills/session-fork-to-destination/SKILL.md
index 4f242763..f19a098a 100644
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
-  version: '0.2.36'
+  version: '0.2.38'
 ---
 
 # {{distribution.name}}
 
 > **Alpha.** This skill discovers and previews local sessions
 > read-only, then prepares instructions. It does not run a provider, authenticate,
 > create a fork, write a receipt, retry, reconcile a child ID, or control an IDE tab.
 
diff --git a/src/skills/session-observer-collab/SKILL.md b/src/skills/session-observer-collab/SKILL.md
index 5181cbdd..c9f79641 100644
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
-  version: '1.0.59'
+  version: '1.0.61'
 ---
 
 # {{distribution.name}}
 
 Coordinate a user and two agent sessions through the canonical
 `{{skill:session-observer}}` skill. This skill defines collaboration protocol and wake
 boundaries; it does not reimplement transcript discovery, normalization,
 rendering, or offset storage.
diff --git a/src/skills/session-observer-collab/src/completion.test.ts b/src/skills/session-observer-collab/src/completion.test.ts
index 5379d4fa..e42b81ad 100644
--- a/src/skills/session-observer-collab/src/completion.test.ts
+++ b/src/skills/session-observer-collab/src/completion.test.ts
@@ -440,16 +440,45 @@ describe('normalized completed continuation selection', () => {
 
     const mismatched = cursorCompletionDigest([]);
     mismatched.range.indexBase = 'zero-based-jsonl-record-index';
     expect(() => selectCompletedContinuation(mismatched)).toThrow(
       /index base/i,
     );
   });
 
+  test('does not treat terminal metadata as peer-message continuation authority', () => {
+    const observerResult = {
+      ...digest([], 2, 3),
+      terminalEvents: [
+        {
+          type: 'terminal',
+          runtime: 'codex',
+          sessionId: 'peer',
+          nativeSessionId: 'peer',
+          nativeType: 'turn_aborted',
+          status: 'aborted',
+          source: {
+            indexBase: 'zero-based-jsonl-record-index',
+            recordIndex: 2,
+            physicalLine: 3,
+            jsonPointer: '/payload',
+          },
+        },
+      ],
+    };
+
+    expect(selectCompletedContinuation(observerResult)).toMatchObject({
+      status: 'no-continuation',
+      continuation: false,
+      peerCursor: 3,
+      budgetCost: 0,
+    });
+  });
+
   test('selects a substantive assistant response after automatic control without treating the envelope as authority', () => {
     const result = selectCompletedContinuation(
       digest(
         [
           message('user', '{wake}', 3, {
             displayRole: 'automatic-control',
             origin: 'automatic-control',
             automaticControl: {
diff --git a/src/skills/session-observer/SKILL.md b/src/skills/session-observer/SKILL.md
index 7bf5a70b..93a4f2f3 100644
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
-  version: '1.0.71'
+  version: '1.0.73'
 ---
 
 # {{distribution.name}}
 
 Lets you (Claude Code, Codex, or Cursor) inspect another runtime's transcript for the current project, render a tool-free digest, and track runtime-specific read positions so follow-up checks surface only new content.
 
 ## Local runtime preflight
 
@@ -323,19 +323,27 @@ On exit 3 (ambiguousRuntime):
 ```
 
 **Watch mode operation:**
 
 Use `watch` when the user explicitly asks to keep monitoring a peer session, respond as new peer activity arrives, or watch another terminal while the current invocation remains active. `watch` is a foreground process: keep it running, actively read or poll its stdout, and respond to each emitted digest until the user asks you to stop, `watch-ctl stop` exits the watcher, `--max-runtime-min` expires, or the process exits for another reason. Startup prints: `Watcher is now active. Keep this process open and continue reading stdout. Do not treat baseline setup as a completed watch.`
 
 For combined catch-up/watch requests, run `catch-up-then-watch`. Starting `watch` alone establishes an initial baseline and does not emit already-unread transcript content.
 
-Each emitted watch digest is equivalent to a debounced `catch-up` result and advances the runtime-specific high-water mark. Schema-v1/non-Cursor targets consume JSONL records. Cursor schema v2 consumes physical JSONL frames only after its stability, continuity, and delivery checks pass. The debounce waits for `--debounce-sec` seconds of quiet, but continuous writes are still emitted after `--max-pending-sec` seconds so a busy transcript cannot starve the watcher indefinitely. If the watcher prints JSON lines, route by stable event type: `baseline`, `delta`, `heartbeat`, `stopped`, or `error`. Respond to `delta` events with digest content; stay quiet on `baseline` and `heartbeat` unless their metadata shows a problem. If it prints markdown, read each emitted digest before commenting.
+Each emitted watch digest is equivalent to a debounced `catch-up` result and advances the runtime-specific high-water mark. Schema-v1/non-Cursor targets consume JSONL records. Cursor schema v2 consumes physical JSONL frames only after its stability, continuity, and delivery checks pass. The debounce waits for `--debounce-sec` seconds of quiet, but continuous writes are still emitted after `--max-pending-sec` seconds so a busy transcript cannot starve the watcher indefinitely. If the watcher prints JSON lines, route by stable event type: `baseline`, `delta`, `terminal`, `heartbeat`, `stopped`, or `error`. Respond to `delta` events with digest content; treat `terminal` as lifecycle metadata; stay quiet on `baseline` and `heartbeat` unless their metadata shows a problem. If it prints markdown, read each emitted digest before commenting.
 
-`--quiet-empty` is useful for collaboration watches: metadata-only growth still advances the offset, but no empty delta is printed. This does not mean nothing was written; it means the growth did not produce a rendered message under the active filters. `--strict-baseline` protects a standalone `watch` from silently skipping a previously unread range. Without it, such a start emits one `baseline-gap` warning with the zero-based skipped range; with it, startup refuses and leaves the prior offset intact. `catch-up-then-watch` first renders unread backlog and therefore does not create a baseline gap.
+A `terminal` event reports a natively recorded unsuccessful turn without copying the transcript body or provider error message. Its source locator belongs to the exact consumed record or frame range. Terminal-only growth still advances the checkpoint and is delivered at most once; `--quiet-empty` suppresses only an empty `delta`, never the terminal event. A later successful record does not erase an earlier terminal event. Terminal metadata is evidence about peer lifecycle, not a peer-authored message or authority to send or continue collaboration work.
+
+Runtime evidence is intentionally narrow:
+
+- Claude Code accepts explicit assistant API-error, aborted-mid-stream, and truncated flags in that precedence order. A newly consumed user interruption pointer may join an earlier same-session assistant from the captured transcript, including before the checkpoint; it is suppressed when that assistant already has an explicit abort. Tool failures, denial fields, stop reasons, arbitrary error prose, orphan pointers, and cross-session pointers do not qualify.
+- Codex accepts native `task_complete` records with an error object and `turn_aborted` records. A `usage_limit_exceeded` message may contribute only a validated trailing English `try again at ...` clock or calendar fragment with `inferred-from-error-message` provenance. The fragment is not normalized into an absolute instant, and other error text is omitted.
+- Cursor accepts native error, aborted, and cancelled `turn_ended` frames. Cursor does not expose per-call terminal results here, and terminal error bodies are omitted.
+
+`--quiet-empty` is useful for collaboration watches: filtered growth still advances the offset, but no empty delta is printed. Terminal lifecycle metadata remains visible. This does not mean nothing was written; it means the growth did not produce a rendered message under the active filters. `--strict-baseline` protects a standalone `watch` from silently skipping a previously unread range. Without it, such a start emits one `baseline-gap` warning with the zero-based skipped range; with it, startup refuses and leaves the prior offset intact. `catch-up-then-watch` first renders unread backlog and therefore does not create a baseline gap.
 
 During polling, a pinned watcher may emit a deduplicated `newer-session-candidate` event with identity evidence for a newer same-cwd transcript. It is informational only: the watcher stays pinned and never auto-switches or claims that the candidate superseded the selected peer.
 
 Quiet watches emit heartbeat/status lines every `--heartbeat-sec` seconds by default. Treat heartbeats as liveness/status only; they are not a reason to speak unless `recordsBehind` or `healthy` indicates a problem.
 
 While watch is active, keep the collaboration posture. If the user asks a side question, answer it, then re-engage the foreground watcher unless the user explicitly told you to stop. If your host requires stopping the foreground process before you can answer, restart with `catch-up-then-watch --runtime <peer> --cwd "$PWD" --until-stopped` immediately after the response so unread backlog is consumed before the baseline is reset.
 
 Automatic responses are bounded to the active invocation that started and is polling the watcher. In Claude Code, Codex, Cursor, and similar yield-after-turn harnesses, a backgrounded watch command does not wake the agent when stdout receives a new digest; the caller must keep reading stdout, periodically call `watch-ctl status --json`, or poll the transcript directly. Provider hook integrations that would wake a new invocation after this one ends are deferred; do not imply that watch events will automatically summon an agent after the active invocation has stopped watching.
diff --git a/src/skills/session-observer/src/lib/digest.ts b/src/skills/session-observer/src/lib/digest.ts
index f695340a..b1b5e90f 100644
--- a/src/skills/session-observer/src/lib/digest.ts
+++ b/src/skills/session-observer/src/lib/digest.ts
@@ -43,16 +43,20 @@ import { cursorRenderTurnId } from '../../../../shared/transcript/cursor-analysi
 import {
   type DigestEntry,
   type Runtime,
   readRecords,
   readRecordsDetailed,
   normalizeEntries,
   extractMetaFromRecords,
 } from '../../../../shared/transcript/runtimes.js';
+import {
+  extractCursorTerminalEvents,
+  extractRecordedTerminalEvents,
+} from '../../../../shared/transcript/terminal-events.js';
 import { classifyTranscriptRecords } from './session-classifier.js';
 import type {
   BuildDigestOptions,
   CursorBuildDigestOptions,
   CursorDigestAccountingV2,
   CursorDigestEntryV2,
   CursorDigestV2,
   CursorLifecycleEvent,
@@ -1115,16 +1119,27 @@ function buildCursorDigest(
           mode: activityMode,
           renderFormat: opts.activityRenderFormat ?? 'compact-json',
           deliveryRange,
         },
       );
     }
   }
 
+  const terminalEvents = opts.includeTerminalEvents
+    ? extractCursorTerminalEvents({
+        runtime: 'cursor',
+        sessionId: opts.sessionId ?? opts.cursorIdentity.sessionId,
+        nativeSessionId: opts.cursorIdentity.sessionId,
+        analysis,
+        fromIndex,
+        nextIndex,
+      })
+    : undefined;
+
   return {
     schemaVersion: 2,
     runtime: 'cursor',
     sessionId: opts.sessionId ?? opts.cursorIdentity.sessionId,
     transcriptPath,
     recordedCwd: opts.recordedCwd ?? opts.cursorIdentity.canonicalCwd,
     matchedTier: opts.matchedTier ?? null,
     widenedFrom: opts.widenedFrom ?? null,
@@ -1139,16 +1154,17 @@ function buildCursorDigest(
       totalFrames: scan.totalFrames,
       renderedFromIndex,
       renderedToIndex,
       newFrames: rawCount,
     },
     accounting,
     entries,
     ...(activity ? { activity } : {}),
+    ...(terminalEvents && terminalEvents.length > 0 ? { terminalEvents } : {}),
     filters,
     warnings,
     fallbacks: opts.fallbacks ?? [],
     cursorEvidence: {
       projection: opts.cursorProjection,
       continuity: opts.cursorContinuity,
       status,
       lifecycleEvents,
@@ -1204,33 +1220,35 @@ export async function buildDigest(
 
   const {
     fromIndex = 0,
     mode = 'review',
     includeToolCalls = false,
     includeToolResults = false,
     includeCommandMessages = false,
     includeActivity = false,
+    includeTerminalEvents = false,
     activityRenderFormat = 'compact-json',
     maxTurns,
     maxBytes,
     fallbacks = [],
   } = opts;
 
   const warnings: string[] = [...(opts.warnings ?? [])];
   const effectiveIncludeToolCalls = includeActivity ? false : includeToolCalls;
   const effectiveIncludeToolResults = includeActivity
     ? false
     : includeToolResults;
 
   // Activity and conversation must describe one completed source read. The
   // legacy path stays untouched when activity is off, including its warnings.
-  const capturedRead = includeActivity
-    ? (opts.capturedRead ?? (await readRecordsDetailed(transcriptPath)))
-    : undefined;
+  const capturedRead =
+    includeActivity || includeTerminalEvents
+      ? (opts.capturedRead ?? (await readRecordsDetailed(transcriptPath)))
+      : undefined;
   const records = capturedRead
     ? capturedRead.records.map(({ record }) => record)
     : await readRecords(transcriptPath);
   const totalRecords = records.length;
   const engagement = classifyTranscriptRecords(runtime, records);
   const bootstrapRecordIndexes = new Set(engagement.bootstrapRecordIndexes);
 
   // Extract metadata from the records already read so session identity and
@@ -1264,16 +1282,32 @@ export async function buildDigest(
       `Transcript shrank (stored offset ${fromIndex} > totalRecords ${totalRecords}); reset to 0.`,
     );
   }
 
   const rawFromIndex = effectiveFromIndex;
   const rawToIndex =
     totalRecords > rawFromIndex ? totalRecords - 1 : rawFromIndex;
   const rawCount = Math.max(0, totalRecords - rawFromIndex);
+  const terminalEvents =
+    includeTerminalEvents && capturedRead && runtime !== 'cursor'
+      ? extractRecordedTerminalEvents({
+          runtime,
+          sessionId,
+          nativeSessionId: identity?.nativeSessionId ?? sessionId,
+          read: capturedRead,
+          fromIndex: rawFromIndex,
+          nextIndex: totalRecords,
+        })
+      : undefined;
+  const terminalRecordIndexes = new Set(
+    terminalEvents?.flatMap((event) =>
+      event.source.recordIndex === undefined ? [] : [event.source.recordIndex],
+    ) ?? [],
+  );
 
   // Normalize all records to entries. Keep an unfiltered view for accounting so
   // the digest can explain records consumed but omitted by default filters.
   const allEntriesWithToolsBeforeBootstrap = normalizeEntries(
     runtime,
     records,
     {
       includeToolCalls: true,
@@ -1284,20 +1318,24 @@ export async function buildDigest(
   const allEntriesBeforeBootstrap = normalizeEntries(runtime, records, {
     // The activity projection owns tool calls/results in activity mode. Ask
     // user exchanges survive these filters in the legacy normalizer.
     includeToolCalls: effectiveIncludeToolCalls,
     includeToolResults: effectiveIncludeToolResults,
     includeCommandMessages,
   });
   const allEntriesWithTools = allEntriesWithToolsBeforeBootstrap.filter(
-    (e) => !bootstrapRecordIndexes.has(e.recordIndex),
+    (e) =>
+      !bootstrapRecordIndexes.has(e.recordIndex) &&
+      !terminalRecordIndexes.has(e.recordIndex),
   );
   const allEntries = allEntriesBeforeBootstrap.filter(
-    (e) => !bootstrapRecordIndexes.has(e.recordIndex),
+    (e) =>
+      !bootstrapRecordIndexes.has(e.recordIndex) &&
+      !terminalRecordIndexes.has(e.recordIndex),
   );
 
   // Filter to only entries with recordIndex >= effectiveFromIndex
   const entriesBeforeTailSlice = allEntries.filter(
     (e) => e.recordIndex >= effectiveFromIndex,
   );
   let filteredEntries = entriesBeforeTailSlice;
 
@@ -1520,16 +1558,17 @@ export async function buildDigest(
     widenedFrom: opts.widenedFrom ?? null,
     active: opts.active ?? false,
     engagement,
     mode,
     range,
     accounting,
     entries: filteredEntries,
     ...(activity ? { activity } : {}),
+    ...(terminalEvents && terminalEvents.length > 0 ? { terminalEvents } : {}),
     filters,
     warnings,
     fallbacks,
   };
 }
 
 // ---------------------------------------------------------------------------
 // renderMarkdown
diff --git a/src/skills/session-observer/src/lib/observe.ts b/src/skills/session-observer/src/lib/observe.ts
index 156a6c36..433196fe 100644
--- a/src/skills/session-observer/src/lib/observe.ts
+++ b/src/skills/session-observer/src/lib/observe.ts
@@ -537,16 +537,17 @@ async function buildCatchUpDigest(
   runtime: Runtime,
   candidate: TranscriptCandidate,
   {
     fromIndex,
     includeTools,
     includeToolResults,
     includeCommandMessages,
     includeActivity,
+    includeTerminalEvents,
     activityRenderFormat,
     maxTurns,
     maxBytes,
     matchedTier = null,
     active = false,
     warnings = [],
     fallbacks = [],
   }: BuildDigestOptions & {
@@ -556,16 +557,17 @@ async function buildCatchUpDigest(
 ): Promise<Digest> {
   return buildDigest(runtime, candidate.transcriptPath, {
     fromIndex,
     mode: 'catch-up',
     includeToolCalls: includeTools,
     includeToolResults,
     includeCommandMessages,
     includeActivity,
+    includeTerminalEvents,
     activityRenderFormat,
     maxTurns,
     maxBytes,
     sessionId: candidate.sessionId,
     recordedCwd: candidate.recordedCwd,
     matchedTier,
     active,
     warnings,
diff --git a/src/skills/session-observer/src/lib/types.ts b/src/skills/session-observer/src/lib/types.ts
index 9480224d..5a80c886 100644
--- a/src/skills/session-observer/src/lib/types.ts
+++ b/src/skills/session-observer/src/lib/types.ts
@@ -16,16 +16,17 @@ import type {
   CursorTerminalStatus,
   DigestEntry,
   DigestEntryOrigin,
   JsonObject,
   Runtime,
   TranscriptMeta,
   DetailedTranscriptRead,
 } from '../../../../shared/transcript/runtimes.js';
+import type { UnsuccessfulTerminalEvent } from '../../../../shared/transcript/terminal-events.js';
 
 export type {
   AutomaticControlProvenance,
   CursorTerminalStatus,
   DigestEntryOrigin,
 };
 
 export type SessionObserverRuntime = Runtime;
@@ -454,16 +455,17 @@ export interface DigestFilters {
 
 export interface BuildDigestOptions {
   fromIndex?: number;
   mode?: DigestMode;
   includeToolCalls?: boolean;
   includeToolResults?: boolean;
   includeCommandMessages?: boolean;
   includeActivity?: boolean;
+  includeTerminalEvents?: boolean;
   activityRenderFormat?: ActivityRenderFormat;
   capturedRead?: DetailedTranscriptRead;
   maxTurns?: number;
   maxBytes?: number;
   sessionId?: string;
   identity?: TranscriptMeta | null;
   recordedCwd?: string | null;
   matchedTier?: RankTier | null;
@@ -488,16 +490,18 @@ export interface Digest {
   widenedFrom: string | null;
   active: boolean;
   engagement: TranscriptClassification;
   mode: DigestMode;
   range: DigestRange;
   accounting: DigestAccounting;
   entries: DigestEntry[];
   activity?: ActivityReport;
+  /** Watch-only metadata for unsuccessful native terminal records. */
+  terminalEvents?: UnsuccessfulTerminalEvent[];
   /** Watch-only marker for a delta containing activity but no conversation. */
   activityOnly?: true;
   filters: DigestFilters;
   warnings: string[];
   fallbacks: TranscriptCandidate[];
 }
 
 export interface CursorDigestRangeV2 {
@@ -740,16 +744,18 @@ export interface WatchLoopArgs {
   cwdProvided?: boolean;
   json?: boolean;
   session?: string;
   snippet?: string;
   includeTools?: boolean;
   includeToolResults?: boolean;
   includeCommandMessages?: boolean;
   includeActivity?: boolean;
+  /** Internal watch pipeline switch; not a public CLI option. */
+  includeTerminalEvents?: boolean;
   activityRenderFormat?: ActivityRenderFormat;
   maxTurns?: number;
   maxBytes?: number;
   debounceSec?: number;
   pollSec?: number;
   maxPendingSec?: number;
   maxRuntimeMin?: number;
   heartbeatSec?: number;
diff --git a/src/skills/session-observer/src/lib/watch.ts b/src/skills/session-observer/src/lib/watch.ts
index ebab4b09..50ca6165 100644
--- a/src/skills/session-observer/src/lib/watch.ts
+++ b/src/skills/session-observer/src/lib/watch.ts
@@ -6,16 +6,17 @@ import { appendFile, lstat, mkdir, realpath, stat } from 'node:fs/promises';
 import { homedir } from 'node:os';
 import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
 
 import { scanCursorTranscript } from '../../../../shared/transcript/cursor-frames.js';
 import {
   type Runtime,
   readRecords,
 } from '../../../../shared/transcript/runtimes.js';
+import type { UnsuccessfulTerminalEvent } from '../../../../shared/transcript/terminal-events.js';
 import * as cursorStateLib from './cursor-state.js';
 import { renderMarkdown } from './digest.js';
 import {
   ClassificationCache,
   findNewerSameCwdCandidates,
   findSessionCandidate,
   resolveCursorIdentity,
 } from './locate.js';
@@ -331,29 +332,61 @@ function eventMetadata(ts: string, digest: SessionDigest, rendered: string) {
     newRecords: digestNewRecords(digest),
     digestChars: rendered.length,
     ranges: eventRanges(digest),
     ...(digest.activityOnly ? { activityOnly: true } : {}),
   };
 }
 
 function stdoutEvent(ts: string, digest: SessionDigest, rendered: string) {
+  const { terminalEvents: _terminalEvents, ...publicDigest } = digest;
   return {
     type: 'delta',
     ts,
     runtime: digest.runtime,
     sessionId: digest.sessionId,
     newRecords: digestNewRecords(digest),
     digestChars: rendered.length,
     ranges: eventRanges(digest),
     ...(digest.activityOnly ? { activityOnly: true } : {}),
-    digest,
+    digest: publicDigest,
   };
 }
 
+function terminalOutputEvent(
+  ts: string,
+  event: UnsuccessfulTerminalEvent,
+): UnsuccessfulTerminalEvent & { ts: string } {
+  return { ...event, ts };
+}
+
+function renderTerminalEvent(event: UnsuccessfulTerminalEvent): string {
+  const coordinate =
+    event.source.frameIndex === undefined
+      ? `record=${event.source.recordIndex}`
+      : `frame=${event.source.frameIndex}`;
+  const retry = event.retryEvidence
+    ? ` retry=${JSON.stringify(event.retryEvidence.fragment)} retryProvenance=${event.retryEvidence.provenance}`
+    : '';
+  return (
+    `[session-observer] terminal runtime=${event.runtime} session=${event.sessionId} ` +
+    `status=${event.status} ${coordinate}${retry}\n`
+  );
+}
+
+function terminalChunk(
+  args: WatchLoopArgs,
+  ts: string,
+  event: UnsuccessfulTerminalEvent,
+): string {
+  return args.json
+    ? `${JSON.stringify(terminalOutputEvent(ts, event))}\n`
+    : renderTerminalEvent(event);
+}
+
 async function writeProcessStdout(chunk: string): Promise<void> {
   await new Promise<void>((fulfill, reject) => {
     process.stdout.write(chunk, (error) => {
       if (error) reject(error);
       else fulfill();
     });
   });
 }
@@ -1093,47 +1126,58 @@ async function emitCursorDelta(
   result: CursorObserveSuccess,
   target: WatchTarget,
   args: WatchLoopArgs,
   deps: ResolvedWatchDeps,
   eventState: WatchEventState,
 ): Promise<boolean> {
   const newFrames = result.digest.range.newFrames;
   const activity = prepareActivityDelta(result.digest, target);
-  const shouldRender =
+  const terminalEvents = result.digest.terminalEvents ?? [];
+  const shouldRenderDelta =
     (newFrames > 0 || activity.renderable) &&
     !(
       args.quietEmpty &&
       result.digest.accounting.rendered.count === 0 &&
       !activity.renderable
     );
-  if (shouldRender) {
-    const rendered = renderMarkdown(result.digest);
+  if (shouldRenderDelta || terminalEvents.length > 0) {
+    const rendered = shouldRenderDelta ? renderMarkdown(result.digest) : '';
     const ts = new Date(deps.now()).toISOString();
-    await finalizeCursorOutput(
-      result,
-      args.json
-        ? JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + '\n'
-        : rendered + '\n',
-      deps,
-    );
+    const output = [
+      ...terminalEvents.map((event) => terminalChunk(args, ts, event)),
+      ...(shouldRenderDelta
+        ? [
+            args.json
+              ? `${JSON.stringify(stdoutEvent(ts, result.digest, rendered))}\n`
+              : `${rendered}\n`,
+          ]
+        : []),
+    ].join('');
+    await finalizeCursorOutput(result, output, deps);
     const committedState = await cursorStateLib.getCursorSession(
       result.digest.sessionId,
     );
     if (committedState) {
       await persistCursorTarget(target, eventState.pid, committedState, result);
     }
-    await appendEventLog(
-      args.eventLog,
-      eventMetadata(ts, result.digest, rendered),
-    );
+    for (const event of terminalEvents) {
+      await appendEventLog(args.eventLog, terminalOutputEvent(ts, event));
+    }
+    if (shouldRenderDelta) {
+      await appendEventLog(
+        args.eventLog,
+        eventMetadata(ts, result.digest, rendered),
+      );
+    }
     if (activity.diagnosticSignature) {
       target.lastActivityDiagnosticSignature = activity.diagnosticSignature;
     }
-    eventState.eventCount++;
+    eventState.eventCount +=
+      terminalEvents.length + (shouldRenderDelta ? 1 : 0);
     eventState.lastHeartbeatAt = deps.now();
     await watchStateLib.recordWatcherEvent({
       pid: eventState.pid,
       lastEventAt: ts,
     });
     return true;
   }
 
@@ -1147,16 +1191,72 @@ async function emitCursorDelta(
     result.digest.sessionId,
   );
   if (current) {
     await persistCursorTarget(target, eventState.pid, current, result);
   }
   return false;
 }
 
+async function emitLegacyWatchEvents(
+  result: ObserveSuccess,
+  target: WatchTarget,
+  args: WatchLoopArgs,
+  deps: ResolvedWatchDeps,
+  eventState: WatchEventState,
+): Promise<boolean> {
+  const newRecords = result.digest.range.newRecords ?? 0;
+  const activity = prepareActivityDelta(result.digest, target);
+  const terminalEvents = result.digest.terminalEvents ?? [];
+  const shouldRenderDelta =
+    (newRecords > 0 || activity.renderable) &&
+    !(
+      args.quietEmpty &&
+      result.digest.accounting.rendered.count === 0 &&
+      !activity.renderable
+    );
+  if (!shouldRenderDelta && terminalEvents.length === 0) return false;
+
+  const rendered = shouldRenderDelta ? renderMarkdown(result.digest) : '';
+  const ts = new Date(deps.now()).toISOString();
+  const output = [
+    ...terminalEvents.map((event) => terminalChunk(args, ts, event)),
+    ...(shouldRenderDelta
+      ? [
+          args.json
+            ? `${JSON.stringify(stdoutEvent(ts, result.digest, rendered))}\n`
+            : `${rendered}\n`,
+        ]
+      : []),
+  ].join('');
+  await writeStdoutChunk(deps, output);
+  for (const event of terminalEvents) {
+    await appendEventLog(args.eventLog, terminalOutputEvent(ts, event));
+  }
+  if (shouldRenderDelta) {
+    await appendEventLog(
+      args.eventLog,
+      eventMetadata(ts, result.digest, rendered),
+    );
+  }
+  if (activity.diagnosticSignature) {
+    target.lastActivityDiagnosticSignature = activity.diagnosticSignature;
+  }
+  eventState.eventCount += terminalEvents.length + (shouldRenderDelta ? 1 : 0);
+  eventState.lastHeartbeatAt = deps.now();
+  await watchStateLib.recordWatcherEvent({
+    pid: eventState.pid,
+    lastEventAt: ts,
+  });
+  await stateLib
+    .setWatchedByPid(result.runtime, result.digest.sessionId, eventState.pid)
+    .catch(() => false);
+  return true;
+}
+
 async function establishCursorBaseline(
   args: WatchLoopArgs & { cwd: string },
   targets: Map<string, WatchTarget>,
   deps: ResolvedWatchDeps,
   eventState: WatchEventState,
 ): Promise<WatchTarget> {
   const target = await cursorBaselineTarget(args, targets, deps, eventState);
   const result = await observeCatchUp(
@@ -1576,99 +1676,27 @@ async function emitPending(
     );
     target.signature = await fileSignature(target.transcriptPath, deps.stat);
     if (result.deliveryUncertain) return false;
     return emitCursorDelta(result, target, args, deps, eventState);
   }
 
   const target = targets.get(entry.key);
   if (!target) return false;
-  const newRecords = result.digest.range.newRecords ?? 0;
-  const activity = prepareActivityDelta(result.digest, target);
-  if (newRecords <= 0 && !activity.renderable) return false;
-  if (
-    args.quietEmpty &&
-    result.digest.accounting.rendered.count === 0 &&
-    !activity.renderable
-  ) {
-    return false;
-  }
-
-  const rendered = renderMarkdown(result.digest);
-  const ts = new Date(deps.now()).toISOString();
-  const metadata = eventMetadata(ts, result.digest, rendered);
-
-  if (args.json) {
-    await writeStdoutChunk(
-      deps,
-      JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + '\n',
-    );
-  } else {
-    await writeStdoutChunk(deps, rendered + '\n');
-  }
-  await appendEventLog(args.eventLog, metadata);
-  if (activity.diagnosticSignature) {
-    target.lastActivityDiagnosticSignature = activity.diagnosticSignature;
-  }
-  eventState.eventCount++;
-  eventState.lastHeartbeatAt = deps.now();
-  await watchStateLib.recordWatcherEvent({
-    pid: eventState.pid,
-    lastEventAt: ts,
-  });
-  await stateLib
-    .setWatchedByPid(result.runtime, result.digest.sessionId, eventState.pid)
-    .catch(() => false);
-  return true;
+  return emitLegacyWatchEvents(result, target, args, deps, eventState);
 }
 
 async function emitObservedDelta(
   result: ObserveSuccess,
   target: WatchTarget,
   args: WatchLoopArgs,
   deps: ResolvedWatchDeps,
   eventState: WatchEventState,
 ): Promise<boolean> {
-  const newRecords = result.digest.range.newRecords ?? 0;
-  const activity = prepareActivityDelta(result.digest, target);
-  if (newRecords <= 0 && !activity.renderable) return false;
-  if (
-    args.quietEmpty &&
-    result.digest.accounting.rendered.count === 0 &&
-    !activity.renderable
-  ) {
-    return false;
-  }
-
-  const rendered = renderMarkdown(result.digest);
-  const ts = new Date(deps.now()).toISOString();
-  const metadata = eventMetadata(ts, result.digest, rendered);
-
-  if (args.json) {
-    await writeStdoutChunk(
-      deps,
-      JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + '\n',
-    );
-  } else {
-    await writeStdoutChunk(deps, rendered + '\n');
-  }
-  await appendEventLog(args.eventLog, metadata);
-  if (activity.diagnosticSignature) {
-    target.lastActivityDiagnosticSignature = activity.diagnosticSignature;
-  }
-  eventState.eventCount++;
-  eventState.lastHeartbeatAt = deps.now();
-  await watchStateLib.recordWatcherEvent({
-    pid: eventState.pid,
-    lastEventAt: ts,
-  });
-  await stateLib
-    .setWatchedByPid(result.runtime, result.digest.sessionId, eventState.pid)
-    .catch(() => false);
-  return true;
+  return emitLegacyWatchEvents(result, target, args, deps, eventState);
 }
 
 async function emitReadyPending(
   args: WatchLoopArgs & { cwd: string },
   targets: Map<string, WatchTarget>,
   pending: Map<string, PendingEntry>,
   deps: ResolvedWatchDeps,
   eventState: WatchEventState,
@@ -1771,16 +1799,17 @@ export async function runWatchLoop(
     : undefined;
   const resolvedMaxPendingMs = maxPendingMs(args.maxPendingSec);
   const resolvedHeartbeatMs = heartbeatMs(args.heartbeatSec);
   const normalizedArgs: WatchLoopArgs & { cwd: string } = {
     ...args,
     runtime,
     cwd,
     eventLog,
+    includeTerminalEvents: true,
     maxPendingSec: resolvedMaxPendingMs / 1000,
     heartbeatSec: resolvedHeartbeatMs === null ? 0 : resolvedHeartbeatMs / 1000,
   };
   const pollMs = toPositiveMs(args.pollSec, DEFAULT_POLL_SEC);
   const debounceMs = toPositiveMs(args.debounceSec, DEFAULT_DEBOUNCE_SEC);
   const limitMs = maxRuntimeMs(args.maxRuntimeMin);
   const startedAtMs = (deps.now ?? Date.now)();
   const deadlineMs = limitMs === null ? null : startedAtMs + limitMs;
diff --git a/src/skills/session-observer/src/watch.test.ts b/src/skills/session-observer/src/watch.test.ts
index 52a14048..f37e8808 100644
--- a/src/skills/session-observer/src/watch.test.ts
+++ b/src/skills/session-observer/src/watch.test.ts
@@ -953,56 +953,392 @@ describe('runWatchLoop', () => {
         ]),
       );
       expect(await legacySessionState(stateDir, sessionId)).toMatchObject({
         lastRecordIndex: 2,
       });
 
       const rearmMessage = 'renderable message after SIGTERM';
       await appendCodexMessage(transcriptPath, sessionId, rearmMessage);
-      const second = await runCli(
+      const secondChild = spawn(
+        'node',
         [
+          CLI_PATH,
           'catch-up-then-watch',
           '--runtime',
           'codex',
           '--session',
           `codex:${sessionId}`,
           '--cwd',
           cwd,
           '--poll-sec',
           '0.02',
           '--debounce-sec',
           '0.02',
           '--max-runtime-min',
-          '0.002',
+          '0',
           '--json',
         ],
-        env,
-      );
-      expect(
-        second.status,
-        `re-arm failed\nstdout: ${second.stdout}\nstderr: ${second.stderr}`,
-      ).toBe(0);
-      const deltas = parseJsonLines(second.stdout).filter(
-        (event) => event.type === 'delta',
+        { env, stdio: ['ignore', 'pipe', 'pipe'] },
       );
+      let secondStdout = '';
+      let secondStderr = '';
+      secondChild.stdout.setEncoding('utf8');
+      secondChild.stderr.setEncoding('utf8');
+      secondChild.stdout.on('data', (chunk) => {
+        secondStdout += chunk;
+      });
+      secondChild.stderr.on('data', (chunk) => {
+        secondStderr += chunk;
+      });
+
+      try {
+        await waitFor(async () => {
+          if (!secondStdout.endsWith('\n')) return false;
+          const deltas = parseJsonLines(secondStdout).filter(
+            (event) => event.type === 'delta',
+          );
+          const checkpoint = await legacySessionState(stateDir, sessionId);
+          return deltas.length === 1 && checkpoint?.lastRecordIndex === 3;
+        });
+        secondChild.kill('SIGTERM');
+        const [code, signal] = await once(secondChild, 'exit');
+        expect(signal, secondStderr).toBe(null);
+        expect(code, secondStderr).toBe(0);
+      } finally {
+        if (secondChild.exitCode === null && secondChild.signalCode === null) {
+          secondChild.kill('SIGKILL');
+        }
+      }
+
+      const secondEvents = parseJsonLines(secondStdout);
+      const deltas = secondEvents.filter((event) => event.type === 'delta');
       expect(deltas).toHaveLength(1);
       expect(deltas[0]).toMatchObject({
         ranges: {
           fromIndex: 2,
           nextIndex: 3,
           renderedFromIndex: 2,
           renderedToIndex: 2,
         },
         digest: {
           entries: [expect.objectContaining({ text: rearmMessage })],
         },
       });
       expect(await legacySessionState(stateDir, sessionId)).toMatchObject({
         lastRecordIndex: 3,
+        lastTotalRecords: 3,
+      });
+      expect(secondEvents.filter((event) => event.type === 'stopped')).toEqual([
+        expect.objectContaining({ reason: 'signal' }),
+      ]);
+    });
+  });
+
+  test('emits a metadata-only Codex terminal event under quiet-empty and does not replay it', async () => {
+    await withTempSessionHome(async (home, stateDir) => {
+      const cwd = '/test/watch-codex-terminal-only';
+      const sessionId = 'watch-codex-terminal-only';
+      const transcriptPath = await writeCodexTranscript(home, cwd, sessionId, [
+        { role: 'assistant', content: 'terminal baseline' },
+      ]);
+
+      let baselineNow = Date.UTC(2026, 8, 20, 12, 0, 0);
+      await runWatchLoop(
+        {
+          runtime: 'codex',
+          cwd,
+          session: `codex:${sessionId}`,
+          json: true,
+          pollSec: 0.02,
+          debounceSec: 0.02,
+          maxRuntimeMin: 0.002,
+        },
+        {
+          now: () => baselineNow,
+          sleep: async (ms: number) => {
+            baselineNow += ms;
+          },
+          writeStdout: () => {},
+        },
+      );
+
+      const privateErrorBody = 'private Codex provider failure body';
+      await appendFile(
+        transcriptPath,
+        `${JSON.stringify({
+          type: 'event_msg',
+          payload: {
+            type: 'task_complete',
+            error: {
+              codex_error_info: 'usage_limit_exceeded',
+              message: `${privateErrorBody}; try again at Sep 19th, 2026 5:01 AM.`,
+            },
+          },
+        })}\n`,
+        'utf8',
+      );
+
+      const stdout: string[] = [];
+      let nowMs = Date.UTC(2026, 8, 20, 12, 5, 0);
+      const result = await runWatchLoop(
+        {
+          runtime: 'codex',
+          cwd,
+          session: `codex:${sessionId}`,
+          catchUpFirst: true,
+          quietEmpty: true,
+          json: true,
+          eventLog: 'terminal-events.jsonl',
+          pollSec: 0.02,
+          debounceSec: 0.02,
+          maxRuntimeMin: 0.004,
+        },
+        {
+          now: () => nowMs,
+          sleep: async (ms: number) => {
+            nowMs += ms;
+          },
+          writeStdout: (chunk: string) => stdout.push(chunk),
+        },
+      );
+
+      const events = parseJsonLines(stdout.join(''));
+      const terminals = events.filter((event) => event.type === 'terminal');
+      expect(result.eventCount).toBe(1);
+      expect(terminals).toEqual([
+        expect.objectContaining({
+          runtime: 'codex',
+          sessionId,
+          nativeSessionId: sessionId,
+          nativeType: 'task_complete',
+          status: 'error',
+          nativeErrorCode: 'usage_limit_exceeded',
+          source: {
+            indexBase: 'zero-based-jsonl-record-index',
+            recordIndex: 2,
+            physicalLine: 3,
+            jsonPointer: '/payload',
+          },
+          retryEvidence: {
+            fragment: 'Sep 19th, 2026 5:01 AM',
+            provenance: 'inferred-from-error-message',
+            source: expect.objectContaining({
+              recordIndex: 2,
+              jsonPointer: '/payload/error/message',
+            }),
+          },
+        }),
+      ]);
+      expect(events.some((event) => event.type === 'delta')).toBe(false);
+      expect(stdout.join('')).not.toContain(privateErrorBody);
+      expect(await legacySessionState(stateDir, sessionId)).toMatchObject({
+        lastRecordIndex: 3,
+        lastTotalRecords: 3,
+      });
+
+      const eventLog = await readFile(
+        join(stateDir, 'terminal-events.jsonl'),
+        'utf8',
+      );
+      expect(parseJsonLines(eventLog)).toEqual([
+        expect.objectContaining({
+          type: 'terminal',
+          runtime: 'codex',
+          status: 'error',
+        }),
+      ]);
+      expect(eventLog).not.toContain(privateErrorBody);
+      expect(eventLog).not.toContain('"digest"');
+
+      const replayStdout: string[] = [];
+      let replayNow = Date.UTC(2026, 8, 20, 12, 10, 0);
+      const replay = await runWatchLoop(
+        {
+          runtime: 'codex',
+          cwd,
+          session: `codex:${sessionId}`,
+          catchUpFirst: true,
+          quietEmpty: true,
+          json: true,
+          pollSec: 0.02,
+          debounceSec: 0.02,
+          maxRuntimeMin: 0.002,
+        },
+        {
+          now: () => replayNow,
+          sleep: async (ms: number) => {
+            replayNow += ms;
+          },
+          writeStdout: (chunk: string) => replayStdout.push(chunk),
+        },
+      );
+      expect(replay.eventCount).toBe(0);
+      expect(
+        parseJsonLines(replayStdout.join('')).some(
+          (event) => event.type === 'terminal',
+        ),
+      ).toBe(false);
+    });
+  });
+
+  test('joins Claude interruption pointers across the checkpoint and suppresses explicit-abort duplicates', async () => {
+    await withTempSessionHome(async (home, stateDir) => {
+      const cwd = '/test/watch-claude-interruption-terminal';
+      const sessionId = 'watch-claude-interruption-terminal';
+      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
+        { content: 'interruption baseline' },
+      ]);
+      await appendFile(
+        transcriptPath,
+        [
+          {
+            type: 'assistant',
+            sessionId,
+            isAbortedMidStream: true,
+            message: {
+              id: 'assistant-explicit-abort',
+              role: 'assistant',
+              content: [],
+            },
+          },
+          {
+            type: 'assistant',
+            sessionId,
+            message: {
+              id: 'assistant-interruption-target',
+              role: 'assistant',
+              content: [],
+            },
+          },
+        ]
+          .map((record) => JSON.stringify(record))
+          .join('\n') + '\n',
+        'utf8',
+      );
+
+      let baselineNow = Date.UTC(2026, 8, 20, 12, 0, 0);
+      await runWatchLoop(
+        {
+          runtime: 'claude-code',
+          cwd,
+          session: `claude-code:${sessionId}`,
+          json: true,
+          pollSec: 0.02,
+          debounceSec: 0.02,
+          maxRuntimeMin: 0.002,
+        },
+        {
+          now: () => baselineNow,
+          sleep: async (ms: number) => {
+            baselineNow += ms;
+          },
+          writeStdout: () => {},
+        },
+      );
+      let savedState = await readJsonIfExists(join(stateDir, 'state.json'));
+      expect(savedState?.sessions?.[`claude-code:${sessionId}`]).toMatchObject({
+        lastRecordIndex: 3,
+      });
+
+      await appendFile(
+        transcriptPath,
+        [
+          {
+            type: 'user',
+            sessionId,
+            interruptedMessageId: 'assistant-explicit-abort',
+            message: { role: 'user', content: [] },
+          },
+          {
+            type: 'user',
+            sessionId,
+            interruptedMessageId: 'assistant-interruption-target',
+            message: { role: 'user', content: [] },
+          },
+          {
+            type: 'assistant',
+            sessionId,
+            isApiErrorMessage: true,
+            apiErrorStatus: 503,
+            message: {
+              id: 'assistant-private-api-error',
+              role: 'assistant',
+              content: [
+                {
+                  type: 'text',
+                  text: 'private Claude provider failure body',
+                },
+              ],
+            },
+          },
+        ]
+          .map((record) => JSON.stringify(record))
+          .join('\n') + '\n',
+        'utf8',
+      );
+
+      const stdout: string[] = [];
+      let nowMs = Date.UTC(2026, 8, 20, 12, 5, 0);
+      const result = await runWatchLoop(
+        {
+          runtime: 'claude-code',
+          cwd,
+          session: `claude-code:${sessionId}`,
+          catchUpFirst: true,
+          quietEmpty: true,
+          json: true,
+          pollSec: 0.02,
+          debounceSec: 0.02,
+          maxRuntimeMin: 0.002,
+        },
+        {
+          now: () => nowMs,
+          sleep: async (ms: number) => {
+            nowMs += ms;
+          },
+          writeStdout: (chunk: string) => stdout.push(chunk),
+        },
+      );
+
+      const events = parseJsonLines(stdout.join(''));
+      expect(result.eventCount).toBe(2);
+      expect(events.filter((event) => event.type === 'terminal')).toEqual([
+        expect.objectContaining({
+          runtime: 'claude-code',
+          sessionId,
+          nativeType: 'user-interruption',
+          status: 'interrupted',
+          source: {
+            indexBase: 'zero-based-jsonl-record-index',
+            recordIndex: 4,
+            physicalLine: 5,
+            jsonPointer: '/interruptedMessageId',
+          },
+        }),
+        expect.objectContaining({
+          runtime: 'claude-code',
+          sessionId,
+          nativeType: 'assistant',
+          status: 'api-error',
+          nativeErrorCode: 503,
+          source: {
+            indexBase: 'zero-based-jsonl-record-index',
+            recordIndex: 5,
+            physicalLine: 6,
+            jsonPointer: '',
+          },
+        }),
+      ]);
+      expect(events.some((event) => event.type === 'delta')).toBe(false);
+      expect(stdout.join('')).not.toContain('private Claude provider failure');
+      savedState = await readJsonIfExists(join(stateDir, 'state.json'));
+      expect(savedState?.sessions?.[`claude-code:${sessionId}`]).toMatchObject({
+        lastRecordIndex: 6,
+        lastTotalRecords: 6,
       });
     });
   });
 
   test('advances filtered-only raw ranges without hiding the next renderable Codex message', async () => {
     await withTempSessionHome(async (home, stateDir) => {
       const cwd = '/test/codex-rearm-filtered';
       const sessionId = 'codex-rearm-filtered';
@@ -1680,27 +2016,45 @@ describe('runWatchLoop', () => {
               join(stateDir, 'cursor-state.json'),
             );
             if (state?.sessions?.[`cursor:${sessionId}`]?.lastRecordIndex !== 2)
               return;
             appendedTerminal = true;
             await appendCursorFrame(transcriptPath, {
               type: 'turn_ended',
               status: 'error',
+              error: 'private Cursor terminal body',
             });
           },
         },
       );
 
       expect(appendedTerminal).toBe(true);
       expect(result.reason).toBe('max-runtime');
-      expect(result.eventCount).toBe(1);
-      const deltas = parseJsonLines(stdout.join('')).filter(
-        (event) => event.type === 'delta',
+      expect(result.eventCount).toBe(2);
+      const outputEvents = parseJsonLines(stdout.join(''));
+      expect(outputEvents.filter((event) => event.type === 'terminal')).toEqual(
+        [
+          expect.objectContaining({
+            runtime: 'cursor',
+            sessionId,
+            nativeSessionId: sessionId,
+            nativeType: 'turn_ended',
+            status: 'error',
+            source: {
+              indexBase: 'zero-based-jsonl-frame-index',
+              frameIndex: 2,
+              physicalLine: 3,
+              jsonPointer: '/status',
+            },
+          }),
+        ],
       );
+      expect(stdout.join('')).not.toContain('private Cursor terminal body');
+      const deltas = outputEvents.filter((event) => event.type === 'delta');
       expect(deltas).toHaveLength(1);
       expect(deltas[0]).toMatchObject({
         activityOnly: true,
         newRecords: 1,
         ranges: {
           indexBase: 'zero-based-jsonl-frame-index',
           fromIndex: 2,
           toIndex: 2,

```
