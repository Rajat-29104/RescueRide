import FeaturePage from '../../../../components/FeaturePage'

export default async function AdminFeatureRoute({ params }) {
  const { section } = await params
  return <FeaturePage role="admin" section={section} />
}
