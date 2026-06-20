import { BusinessReportCard } from "./BusinessReportCard"

interface ResultsSectionProps {
  onStaticChange?: (amount: number) => void
  onAssessRisk?: () => void
}

export function ResultsSection({ onStaticChange, onAssessRisk }: ResultsSectionProps) {
  return (
    <BusinessReportCard
      defaultStaticAmount={1000}
      defaultDirectReferrals={0}
      defaultIndirectReferrals={0}
      defaultPerPersonAmount={0}
      onStaticChange={onStaticChange}
      onAssessRisk={onAssessRisk}
    />
  )
}
