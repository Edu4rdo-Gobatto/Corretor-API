import { Property } from '../property.entity';

export function toPropertyResponse(property: Property) {
  return {
    id: property.id, title: property.title, slug: property.slug,
    type: property.type, purpose: property.purpose, status: property.status,
    price: property.price, condoFee: property.condoFee, iptuFee: property.iptuFee,
    usableArea: property.usableArea, totalArea: property.totalArea,
    addressStreet: property.addressStreet, addressNumber: property.addressNumber,
    addressCity: property.addressCity, addressState: property.addressState,
    neighborhood: property.neighborhood, description: property.description, features: property.features,
    agentId: property.agentId,
    agent: {
      id: property.agent.id, name: property.agent.name, whatsappNumber: property.agent.whatsappNumber,
      creci: property.agent.creci, avatarUrl: property.agent.avatarUrl,
    },
    media: [...(property.media ?? [])]
      .sort((first, second) => first.orderIndex - second.orderIndex || first.id.localeCompare(second.id))
      .map((media) => ({ id: media.id, type: media.type, url: media.url, orderIndex: media.orderIndex, isCover: media.isCover })),
    createdAt: property.createdAt, updatedAt: property.updatedAt,
  };
}
