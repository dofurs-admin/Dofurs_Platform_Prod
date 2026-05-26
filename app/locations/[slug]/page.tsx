import { notFound, permanentRedirect } from 'next/navigation';
import {
  PET_GROOMING_CITY_PATH,
  bengaluruAreas,
  bengaluruAreaBySlug,
  getPetGroomingAreaPath,
  isPublishedPetGroomingArea,
} from '@/lib/service-areas';

type LocationPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return bengaluruAreas.map((area) => ({ slug: area.slug }));
}

export default async function LegacyLocationPage({ params }: LocationPageProps) {
  const { slug } = await params;
  const area = bengaluruAreaBySlug[slug];

  if (!area) {
    notFound();
  }

  if (isPublishedPetGroomingArea(area)) {
    permanentRedirect(getPetGroomingAreaPath(area));
  }

  permanentRedirect(`${PET_GROOMING_CITY_PATH}#bengaluru-coverage`);
}
