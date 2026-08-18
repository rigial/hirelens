import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getScoreColor(score: number) {
  if (score >= 75) {
    return {
      text: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      bar: 'bg-emerald-500',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      bar: 'bg-amber-500',
    };
  }
  return {
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    bar: 'bg-rose-500',
  };
}

/**
 * Formats and normalizes resume text, reconstructing fragmented words and artificial line breaks
 * into clean paragraphs, distinct section headers, and formatted bullet points.
 *
 * @param raw - The raw resume text string
 * @returns Cleanly normalized, wrapped resume text
 */
export function formatResumeText(raw: string): string {
  if (!raw) return '';

  const tokens = raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return '';

  const isBulletSymbol = (t: string) =>
    /^[•●▪▫\*\u2022\u2023\u25E6\u2043\u2219]$/.test(t) ||
    /^\d+[\.\)]$/.test(t) ||
    /^\(\d+\)$/.test(t);

  const KNOWN_SECTIONS_SET = new Set([
    'PROFESSIONAL SUMMARY',
    'EXECUTIVE SUMMARY',
    'SUMMARY',
    'PROFILE',
    'TECHNICAL SKILLS',
    'SKILLS & ABILITIES',
    'SKILLS',
    'CORE COMPETENCIES',
    'PROFESSIONAL EXPERIENCE',
    'WORK EXPERIENCE',
    'EXPERIENCE',
    'EMPLOYMENT HISTORY',
    'CAREER HISTORY',
    'KEY PROJECTS',
    'PERSONAL PROJECTS',
    'PROJECTS',
    'EDUCATION',
    'ACADEMIC BACKGROUND',
    'QUALIFICATIONS',
    'CERTIFICATIONS & LICENSES',
    'CERTIFICATIONS',
    'ACHIEVEMENTS',
    'AWARDS',
    'PUBLICATIONS',
    'LANGUAGES',
    'INTERESTS',
    'VOLUNTEER EXPERIENCE',
    'VOLUNTEERING',
  ]);

  const lines: string[] = [];
  let currentLine: string[] = [];

  const flushLine = () => {
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
      currentLine = [];
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = i + 1 < tokens.length ? tokens[i + 1] : '';
    const next2Token = i + 2 < tokens.length ? tokens[i + 2] : '';

    const candidate3 = `${token} ${nextToken} ${next2Token}`.toUpperCase();
    const candidate2 = `${token} ${nextToken}`.toUpperCase();
    const candidate1 = token.toUpperCase();

    let matchedHeader: string | null = null;
    let headerTokensCount = 0;

    if (KNOWN_SECTIONS_SET.has(candidate3)) {
      matchedHeader = candidate3;
      headerTokensCount = 3;
    } else if (KNOWN_SECTIONS_SET.has(candidate2)) {
      matchedHeader = candidate2;
      headerTokensCount = 2;
    } else if (
      KNOWN_SECTIONS_SET.has(candidate1) &&
      nextToken !== '&' &&
      nextToken !== 'and' &&
      !nextToken.endsWith(':') &&
      !token.endsWith(':')
    ) {
      matchedHeader = candidate1;
      headerTokensCount = 1;
    }

    if (matchedHeader) {
      flushLine();
      lines.push('');
      lines.push(matchedHeader);
      lines.push('');
      i += headerTokensCount - 1;
      continue;
    }

    // If token is a bullet symbol (●, •, etc.)
    if (isBulletSymbol(token)) {
      flushLine();
      currentLine.push('●');
      continue;
    }

    // Role / Project title boundary checks:
    const isRoleStart =
      (token === 'Software' ||
        token === 'Senior' ||
        token === 'Lead' ||
        token === 'Product' ||
        token === 'Frontend' ||
        token === 'Backend' ||
        token === 'Full-Stack' ||
        token === 'Staff' ||
        token === 'Principal') &&
      (nextToken === 'Engineer' ||
        nextToken === 'Developer' ||
        nextToken === 'Architect' ||
        nextToken === 'Designer' ||
        nextToken === 'Manager' ||
        nextToken === 'Development');

    const isProjectOrEduStart =
      (token === 'Bachelor' && nextToken === 'of') ||
      (token === 'Master' && nextToken === 'of') ||
      (token === 'B.E.' || token === 'B.Tech' || token === 'B.S.' || token === 'M.S.');

    if ((isRoleStart || isProjectOrEduStart) && currentLine.length > 0 && currentLine.includes('●')) {
      flushLine();
      lines.push('');
    }

    currentLine.push(token);

    // If token is the end of a date range like "Present" or "2025" and next token is not part of date
    const isDateEnd =
      (token === 'Present' || token === 'Current' || /^(19|20)\d{2}$/.test(token)) &&
      nextToken !== '–' &&
      nextToken !== '-' &&
      nextToken !== 'to' &&
      nextToken !== 'Present' &&
      !/^(19|20)\d{2}$/.test(nextToken);

    if (
      isDateEnd &&
      currentLine.some((w) => ['—', '-', '–'].includes(w)) &&
      !currentLine.includes('●') &&
      currentLine.length >= 4
    ) {
      flushLine();
    }
  }

  flushLine();

  // Normalize blank lines
  const cleaned: string[] = [];
  let prevBlank = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!prevBlank && cleaned.length > 0) {
        cleaned.push('');
        prevBlank = true;
      }
    } else {
      cleaned.push(trimmed);
      prevBlank = false;
    }
  }

  return cleaned.join('\n');
}


