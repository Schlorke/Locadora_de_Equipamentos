'use client'

import { motion } from 'framer-motion'

export function AdminQuotesLoading() {
  return (
    <div className="h-screen w-full overflow-hidden bg-gray-50 flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'linear',
        }}
        className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
      />
    </div>
  )
}
