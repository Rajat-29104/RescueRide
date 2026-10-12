import FeaturePage from '../../../../components/FeaturePage'

export default async function DriverFeatureRoute({ params, searchParams }) {
  const { section } = await params
  const query = await searchParams
  return <FeaturePage role="driver" section={section} mechanicId={query?.mechanic || ''} />
}
