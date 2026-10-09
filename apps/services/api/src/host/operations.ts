import {
  createDriverService,
  createVehicleService,
  createDeliveryService,
} from '@gb-locacoes/backend/operations'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import type {
  DriverService,
  VehicleService,
  DeliveryService,
} from '@gb-locacoes/backend/operations'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'

export function listDrivers(...args: Parameters<DriverService['listDrivers']>) {
  return createDriverService(getDatabaseRuntime().prisma).listDrivers(...args)
}

export function createDriver(
  ...args: Parameters<DriverService['createDriver']>
) {
  return createDriverService(getDatabaseRuntime().prisma).createDriver(...args)
}

function vehicles() {
  const prisma = getDatabaseRuntime().prisma
  const { withRentalTransaction } = createRentalTransaction({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(prisma, context, operation),
  })
  return createVehicleService({ withRentalTransaction })
}

function deliveries() {
  const prisma = getDatabaseRuntime().prisma
  return createDeliveryService({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(prisma, context, operation),
  })
}

export function listVehicles(
  ...args: Parameters<VehicleService['listVehicles']>
) {
  return vehicles().listVehicles(...args)
}

export function createVehicle(
  ...args: Parameters<VehicleService['createVehicle']>
) {
  return vehicles().createVehicle(...args)
}

export function listDeliveries(
  ...args: Parameters<DeliveryService['listDeliveries']>
) {
  return deliveries().listDeliveries(...args)
}

export function createDelivery(
  ...args: Parameters<DeliveryService['createDelivery']>
) {
  return deliveries().createDelivery(...args)
}

export function updateDelivery(
  ...args: Parameters<DeliveryService['updateDelivery']>
) {
  return deliveries().updateDelivery(...args)
}
