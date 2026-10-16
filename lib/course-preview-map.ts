import { reviewStatusOf, toPreviewLesson, type PreviewCourse } from '@/lib/course-review';
import type { Course, Lesson, Module } from '@/lib/db';

export function previewCourseFromUnits(
  course: Course,
  units: { module: Module; lessons: Lesson[] }[],
): PreviewCourse {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    subject: course.subject,
    level: course.level || course.yearGroup,
    language: course.language,
    thumbnailUrl: course.thumbnailUrl,
    status: reviewStatusOf(course.reviewStatus ?? course.status),
    modules: units.map(unit => ({
      id: unit.module.id,
      title: unit.module.title,
      lessons: unit.lessons.map(lesson => toPreviewLesson({
        id: lesson.id,
        title: lesson.title,
        status: lesson.status,
        moduleId: unit.module.id,
        moduleTitle: unit.module.title,
        body: lesson.aiOutputs?.text
          || lesson.contentSources?.find(source => source.type === 'text')?.value
          || '',
        quiz: lesson.aiOutputs?.quiz,
        images: [
          ...(lesson.aiOutputs?.image?.url ? [{ src: lesson.aiOutputs.image.url, alt: lesson.aiOutputs.image.alt, caption: lesson.aiOutputs.image.caption }] : []),
          ...(lesson.aiOutputs?.illustration?.url ? [{ src: lesson.aiOutputs.illustration.url, alt: lesson.aiOutputs.illustration.alt, caption: lesson.aiOutputs.illustration.caption }] : []),
          ...(lesson.videoConfig?.sceneImages ?? []).map(src => ({ src, alt: lesson.title })),
          ...(lesson.mediaLibrary ?? []).map(asset => ({ src: asset.src, alt: asset.alt, caption: asset.caption })),
        ],
        media: [
          ...(lesson.videoConfig?.embedUrl ? [{ kind: 'video' as const, url: lesson.videoConfig.embedUrl, label: 'Video' }] : []),
        ],
      })),
    })),
  };
}
