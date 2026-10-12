import FeaturePage from '../../../../components/FeaturePage'

export default async function MechanicFeatureRoute({ params }) {
  const { section } = await params
  return <FeaturePage role="mechanic" section={section} />
}
