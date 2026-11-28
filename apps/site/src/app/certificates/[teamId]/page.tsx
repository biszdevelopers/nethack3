import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@nethack/ui/static";
import type { PublicCertificate } from "@nethack/contracts";
import { PublicApiError } from "../../../lib/public-api";
import { getPublicCertificate } from "../../../lib/recognition-api";
import { PrintCertificateButton } from "../../../components/print-certificate-button";

export const metadata: Metadata = {
    title: "Certificate",
    robots: { index: false, follow: false },
};

function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
}

export default async function CertificatePage({
    params,
}: {
    readonly params: Promise<{ teamId: string }>;
}): Promise<ReactNode> {
    const { teamId } = await params;
    let certificate: PublicCertificate | null = null;
    try {
        certificate = await getPublicCertificate(teamId);
    } catch (error) {
        if (!(error instanceof PublicApiError && error.message === "Not found")) {
            throw error;
        }
    }

    return (
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <style>{`
                @media print {
                    body header,
                    body footer,
                    body nav,
                    .no-print {
                        display: none !important;
                    }
                    .certificate-sheet {
                        border-color: #111111 !important;
                        background: #ffffff !important;
                        color: #111111 !important;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
                @page {
                    margin: 18mm;
                }
            `}</style>

            <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
                <Button asChild variant="ghost" color="neutral">
                    <Link href="/results">Back to results</Link>
                </Button>
                {certificate === null ? null : <PrintCertificateButton />}
            </div>

            {certificate === null ? (
                <Card variant="outline">
                    <CardHeader>
                        <CardTitle>Certificate not available</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="max-w-prose text-sm text-ink-muted">
                            This certificate is not available. The edition results may not be
                            published, or the team may not have a rank or award.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" color="neutral">
                                <Link href="/results">View results</Link>
                            </Button>
                            <Button asChild variant="subtle" color="neutral">
                                <Link href="/">Return home</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <article
                    className="certificate-sheet flex flex-col gap-6 rounded-xl border-2 border-line bg-panel p-8 text-center sm:p-12"
                    aria-labelledby="certificate-heading"
                >
                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-primary">
                            {certificate.edition.organizationName}
                        </p>
                        <h1
                            id="certificate-heading"
                            className="text-3xl font-extrabold tracking-tight sm:text-4xl"
                        >
                            Certificate of Achievement
                        </h1>
                        <p className="text-sm text-ink-muted">Awarded to</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <p className="break-words text-2xl font-bold sm:text-3xl">
                            {certificate.project?.title ?? certificate.team.name}
                        </p>
                        {certificate.project === null ? null : (
                            <p className="break-words text-lg text-ink-muted">
                                {certificate.team.name}
                            </p>
                        )}
                        <p className="text-sm text-ink-muted">
                            {certificate.edition.name} · {formatDate(certificate.edition.startsAt)}{" "}
                            to {formatDate(certificate.edition.endsAt)}
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        {certificate.rank === null ? null : (
                            <p className="text-xl font-semibold">
                                Rank #{String(certificate.rank)}
                            </p>
                        )}
                        {certificate.awards.length === 0 ? null : (
                            <div className="flex max-w-xl flex-wrap justify-center gap-2">
                                {certificate.awards.map((award) => (
                                    <Badge key={award.id} variant="soft" color="primary" size="md">
                                        <Award className="mr-1 size-3.5" aria-hidden="true" />
                                        {award.name}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-line pt-4">
                        <p className="text-xs text-ink-subtle">
                            Issued by the {certificate.edition.organizationName} organizers for{" "}
                            {certificate.edition.name}. Published{" "}
                            {formatDate(certificate.publishedAt)}.
                        </p>
                    </div>
                </article>
            )}
        </div>
    );
}
