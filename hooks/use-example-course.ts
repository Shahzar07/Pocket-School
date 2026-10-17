'use client';

import { useEffect, useState } from 'react';
import {
  EXAMPLE_COURSES,
  EXAMPLE_PLACEHOLDER_FALLBACK,
  type ExampleCourse,
} from '@/lib/example-courses';

/**
 * Picks one example course after mount. The first render uses a fixed
 * fallback so server HTML and the client hydration pass match.
 */
export function useExampleCourse(): ExampleCourse {
  const [course, setCourse] = useState<ExampleCourse>(EXAMPLE_PLACEHOLDER_FALLBACK);

  useEffect(() => {
    const index = Math.floor(Math.random() * EXAMPLE_COURSES.length);
    setCourse(EXAMPLE_COURSES[index] ?? EXAMPLE_PLACEHOLDER_FALLBACK);
  }, []);

  return course;
}

export function useCoursePlaceholders() {
  const example = useExampleCourse();
  return {
    example,
    title: `e.g. ${example.title}`,
    subject: `e.g. ${example.subject}`,
    level: `e.g. ${example.level}`,
    weeks: `e.g. ${example.weeks}`,
    hours: `e.g. ${example.hours}`,
    description: `e.g. ${example.description}`,
  };
}
