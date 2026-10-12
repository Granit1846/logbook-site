import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { currentFaq, currentRoadmap, withCurrentFeatures, defaultScreenshots } from '@/lib/currentContent';
import type {
  FeatureRow,
  RoadmapRow,
  FaqRow,
  ScreenshotRow,
} from '@/lib/types';

export interface SiteContent {
  features: FeatureRow[];
  roadmap: RoadmapRow[];
  faq: FaqRow[];
  screenshots: ScreenshotRow[];
  loading: boolean;
  error: string | null;
}

export function useSiteContent(): SiteContent {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotRow[]>([]);

  useEffect(() => {
    async function fetchAll() {
      const [f, s] = await Promise.all([
        supabase.from('features').select('*').order('sort_order'),
        supabase.from('screenshots').select('*').order('sort_order'),
      ]);

      if (f.data) setFeatures(f.data as FeatureRow[]);
      if (s.data) {
        const withImages = (s.data as ScreenshotRow[]).filter(
          (row) => typeof row.imageUrl === 'string' && row.imageUrl.trim() !== '',
        );
        if (withImages.length > 0) setScreenshots(withImages);
      }
    }

    fetchAll();
  }, []);

  return { features: withCurrentFeatures(features), roadmap: currentRoadmap, faq: currentFaq, screenshots: screenshots.length > 0 ? screenshots : defaultScreenshots, loading: false, error: null };
}

