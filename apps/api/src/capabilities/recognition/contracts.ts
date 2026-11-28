import type { PublicResults } from "@nethack/contracts";

export interface RecognitionContract {
    getPublishedResults(organizationId: string, editionId: string): Promise<PublicResults | null>;
}

export const RECOGNITION_CONTRACT = "recognition.v1";
