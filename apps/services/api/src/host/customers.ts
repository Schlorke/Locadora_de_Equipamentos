import {
  createAddressService,
  createCustomerProfileService,
  createCustomerCartService,
  AddressNotFound,
  type AddressService,
  type CustomerProfileService,
  type CustomerCartService,
} from '@gb-locacoes/backend/customers'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

export { AddressNotFound }

export function readCustomerCart(
  ...args: Parameters<CustomerCartService['readCustomerCart']>
) {
  return createCustomerCartService(
    getDatabaseRuntime().prisma
  ).readCustomerCart(...args)
}

export function writeCustomerCart(
  ...args: Parameters<CustomerCartService['writeCustomerCart']>
) {
  return createCustomerCartService(
    getDatabaseRuntime().prisma
  ).writeCustomerCart(...args)
}

export function createAddress(
  ...args: Parameters<AddressService['createAddress']>
) {
  return createAddressService(getDatabaseRuntime().prisma).createAddress(
    ...args
  )
}

export function updateAddress(
  ...args: Parameters<AddressService['updateAddress']>
) {
  return createAddressService(getDatabaseRuntime().prisma).updateAddress(
    ...args
  )
}

export function deleteAddress(
  ...args: Parameters<AddressService['deleteAddress']>
) {
  return createAddressService(getDatabaseRuntime().prisma).deleteAddress(
    ...args
  )
}

export function listAddresses(
  ...args: Parameters<AddressService['listAddresses']>
) {
  return createAddressService(getDatabaseRuntime().prisma).listAddresses(
    ...args
  )
}

export function getCustomerProfile(
  ...args: Parameters<CustomerProfileService['getCustomerProfile']>
) {
  return createCustomerProfileService({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(getDatabaseRuntime().prisma, context, operation),
  }).getCustomerProfile(...args)
}

export function updateCustomerProfile(
  ...args: Parameters<CustomerProfileService['updateCustomerProfile']>
) {
  return createCustomerProfileService({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(getDatabaseRuntime().prisma, context, operation),
  }).updateCustomerProfile(...args)
}
