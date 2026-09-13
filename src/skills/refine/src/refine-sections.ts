import path from 'node:path';

import { parseWrapperArgs } from './refine-args.js';
import type {
  IterationModeValue,
  LoopInvocationPayload,
  ParallelManifest,
  ParallelManifestEntry,
  ParsedSection,
  ParsedWrapperOptions,
  ResumeState,
  SectionPaths,
  WrapperOptions,
} from './refine-types.js';

function markdownLines(markdown: unknown) {
  const normalized = String(markdown ?? '').replace(/\r\n?/g, '\n');
  return normalized.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function markerName(line: string) {
  const match = line.trim().match(/^<!--\s*section:\s*(.*?)\s*-->$/i);
  return match?.[1]?.trim() || null;
}

function headingName(line: string) {
  const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
  if (!match) return null;
  return match[1].replace(/\s+#+\s*$/u, '').trim() || null;
}

function buildSectionsFromBoundaries(
  lines: string[],
  boundaries: { lineIndex: number; name: string }[],
) {
  const sections: ParsedSection[] = [];
  const firstBoundary = boundaries[0];

  if (firstBoundary?.lineIndex > 0) {
    const preamble = lines.slice(0, firstBoundary.lineIndex).join('');
    if (preamble.trim()) {
      sections.push({
        id: slugSectionId('Preamble', sections.length),
        name: 'Preamble',
        original_index: sections.length,
        start_line: 1,
        end_line: firstBoundary.lineIndex,
        markdown: preamble,
      });
    }
  }

  for (const [boundaryIndex, boundary] of boundaries.entries()) {
    const nextBoundary = boundaries[boundaryIndex + 1];
    const markdown = lines
      .slice(boundary.lineIndex, nextBoundary?.lineIndex ?? lines.length)
      .join('');
    sections.push({
      id: slugSectionId(boundary.name, sections.length),
      name: boundary.name,
      original_index: sections.length,
      start_line: boundary.lineIndex + 1,
      end_line: nextBoundary?.lineIndex ?? lines.length,
      markdown,
    });
  }

  return sections;
}

export function slugSectionId(name: unknown, index: number) {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'section'}-${index}`;
}

export function parseSections(markdown: unknown): ParsedSection[] {
  const lines = markdownLines(markdown);
  const markerBoundaries: { lineIndex: number; name: string }[] = [];
  const headingBoundaries: { lineIndex: number; name: string }[] = [];

  lines.forEach((line, lineIndex) => {
    const sectionMarkerName = markerName(line);
    if (sectionMarkerName) {
      markerBoundaries.push({ lineIndex, name: sectionMarkerName });
      return;
    }

    const sectionHeadingName = headingName(line);
    if (sectionHeadingName) {
      headingBoundaries.push({ lineIndex, name: sectionHeadingName });
    }
  });

  const boundaries =
    markerBoundaries.length > 0 ? markerBoundaries : headingBoundaries;
  if (boundaries.length > 0) {
    return buildSectionsFromBoundaries(lines, boundaries);
  }

  return [
    {
      id: slugSectionId('Document', 0),
      name: 'Document',
      original_index: 0,
      start_line: 1,
      end_line: lines.length,
      markdown: lines.join(''),
    },
  ];
}

export function normalizeSequentialOptions(
  options: readonly string[] | WrapperOptions,
): ParsedWrapperOptions {
  const parsed = Array.isArray(options) ? parseWrapperArgs(options) : options;
  return {
    goal: '',
    maxRounds: 12,
    agency: 'moderate',
    iteration: 'alternating',
    coldStart: 'shared_input',
    failOnSectionError: false,
    ...parsed,
  } as ParsedWrapperOptions;
}

export function sectionRunDirectory(runDir: string, section: ParsedSection) {
  return path.join(
    runDir,
    'sections',
    `${String(section.original_index + 1).padStart(2, '0')}-${section.id}`,
  );
}

export function sectionLookup<T extends { id: string; original_index: number }>(
  sections: T[] | undefined,
) {
  return new Map(
    (sections ?? []).flatMap((section) => [
      [`id:${section.id}`, section],
      [`index:${section.original_index}`, section],
    ]),
  );
}

export function sequentialRunSections(
  parsedSections: ParsedSection[],
  resumeState: ResumeState | null,
): ParsedSection[] {
  if (!resumeState) return parsedSections;
  const currentSections = sectionLookup(parsedSections);
  return resumeState.sections.map((resumeSection, index) => {
    const currentSection =
      currentSections.get(`id:${resumeSection.id}`) ??
      currentSections.get(`index:${resumeSection.original_index}`) ??
      null;

    return {
      id: resumeSection.id,
      name: resumeSection.name,
      original_index: resumeSection.original_index ?? index,
      markdown: currentSection?.markdown ?? resumeSection.resumedArtifact ?? '',
    };
  });
}

export function loopArgvForSection({
  paths,
  options,
  peers,
  synthesizer = null,
}: LoopInvocationPayload) {
  const argv = [
    '--section-file',
    paths.input,
    '--goal',
    options.goal ?? '',
    '--peers',
    peers.join(','),
    '--max-rounds',
    String(options.maxRounds),
    '--agency',
    options.agency,
    '--iteration',
    options.iteration ?? 'alternating',
  ];
  if (synthesizer) {
    argv.push('--synthesizer', synthesizer);
  }
  argv.push(
    '--output-records',
    paths.records,
    '--output-section',
    paths.output,
    '--output-status',
    paths.status,
  );
  return argv;
}

export function parallelismFor(sectionCount: number, requested: number | null) {
  if (requested !== null && requested !== undefined) {
    return Math.min(requested, sectionCount);
  }
  return Math.min(sectionCount, 4);
}

export function manifestSectionEntry({
  section,
  paths,
  packetPath,
  loopArgv,
  iterationMode = 'alternating',
  synthesizer = null,
}: {
  section: ParsedSection;
  paths: SectionPaths;
  packetPath: string;
  loopArgv: string[];
  iterationMode?: IterationModeValue;
  synthesizer?: string | null;
}): ParallelManifestEntry {
  return {
    section_id: section.id,
    name: section.name,
    original_index: section.original_index,
    packet_path: packetPath,
    section_file: paths.input,
    output_records: paths.records,
    output_section: paths.output,
    output_status: paths.status,
    subagent_id: `section-runner-${String(section.original_index + 1).padStart(2, '0')}-${section.id}`,
    iteration_mode: iterationMode,
    synthesizer,
    loop_argv: loopArgv,
  };
}

export function dispatchInstructions(manifest: ParallelManifest) {
  return {
    phase: 'parallel_dispatch_required',
    manifest: manifest.manifest_path,
    parallelism: manifest.parallelism,
    iteration_mode: manifest.iteration_mode ?? 'alternating',
    synthesizer: manifest.synthesizer ?? null,
    sections: manifest.sections.map((section) => ({
      section_id: section.section_id,
      name: section.name,
      original_index: section.original_index,
      packet_path: section.packet_path,
      subagent_id: section.subagent_id,
      iteration_mode:
        section.iteration_mode ?? manifest.iteration_mode ?? 'alternating',
      synthesizer: section.synthesizer ?? manifest.synthesizer ?? null,
      output_records: section.output_records,
      output_section: section.output_section,
      output_status: section.output_status,
    })),
  };
}
