'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { Link } from '@gb-locacoes/ui'
import { quickActionButtons } from '../model/tipos.web'

export function QuickActionsSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="mb-8"
    >
      <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
        <CardHeader className="relative z-10">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActionButtons.map((button, index) => {
              const IconComponent = button.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: 0.25 + index * 0.08,
                    duration: 0.3,
                    ease: 'easeOut',
                  }}
                  className="group"
                >
                  <Button
                    asChild
                    variant="outline"
                    className="h-40 p-6 w-full bg-white hover:bg-white hover:border-gray-300 transition-all duration-300 shadow-lg hover:shadow-xl border-0 hover:scale-[1.02] group"
                  >
                    <Link
                      href={button.href}
                      className="flex flex-col items-center justify-center gap-3 h-full"
                    >
                      <div
                        className={`w-12 h-12 ${button.iconBg} rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                      >
                        <IconComponent
                          className={`h-6 w-6 ${button.iconColor}`}
                        />
                      </div>
                      <div className="text-center w-full max-w-full px-2">
                        <span className="font-semibold text-lg text-gray-900 group-hover:text-orange-500 block mb-1 break-words whitespace-normal transition-colors duration-300">
                          {button.title}
                        </span>
                        <span className="text-sm text-gray-600 group-hover:text-orange-400 break-words whitespace-normal transition-colors duration-300">
                          {button.subtitle}
                        </span>
                      </div>
                    </Link>
                  </Button>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
