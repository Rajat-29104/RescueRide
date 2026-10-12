import FeaturePage from '../../../../components/FeaturePage'

export default async function DriverFeatureRoute({ params }) {
  const { section } = await params
  return <FeaturePage role="driver" section={section} />
}
