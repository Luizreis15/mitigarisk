import { InfoIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { messages } from '@/lib/i18n/messages';

export function RecommendationNotice() {
  return (
    <Alert className="border-[#c5d4dc] bg-[#e4edf2]">
      <InfoIcon />
      <AlertTitle>{messages.flow.recommendationTitle}</AlertTitle>
      <AlertDescription>{messages.flow.recommendationBody}</AlertDescription>
    </Alert>
  );
}
