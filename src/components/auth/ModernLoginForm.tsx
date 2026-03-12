'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginSchema, type LoginFormData } from '@/lib/schemas/auth.schema'
import { motion } from 'framer-motion'

interface ModernLoginFormProps {
  onSuccess?: () => void
}

export function ModernLoginForm({ onSuccess }: ModernLoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true)
      await login(data.email, data.password)
      onSuccess?.()
    } catch (error: any) {
      setError('root', {
        message: error.message || 'Error en el inicio de sesion',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-[#334155]">
          Iniciar Sesion
        </h2>
        <p className="text-[#7A7A7A] font-medium">
          Accede al panel de control de Avicola del Sur.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1 group">
          <Label
            htmlFor="email"
            className="text-xs font-bold uppercase tracking-wider text-[#2F7058] ml-1 opacity-70 group-focus-within:opacity-100 transition-opacity"
          >
            Correo Electronico
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@empresa.com"
            {...register('email')}
            disabled={isLoading}
            className="h-12 bg-white/50 border-0 border-b-2 border-transparent border-b-[#E5E7EB] rounded-none focus-visible:ring-0 focus-visible:border-b-[#2F7058] transition-all px-1 text-base"
          />
          {errors.email && (
            <p className="text-xs text-red-500 font-medium mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1 group">
          <Label
            htmlFor="password"
            className="text-xs font-bold uppercase tracking-wider text-[#2F7058] ml-1 opacity-70 group-focus-within:opacity-100 transition-opacity"
          >
            Contrasena
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="********"
              {...register('password')}
              disabled={isLoading}
              className="h-12 bg-white/50 border-0 border-b-2 border-transparent border-b-[#E5E7EB] rounded-none focus-visible:ring-0 focus-visible:border-b-[#2F7058] transition-all px-1 text-base pr-10"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              title={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              className="absolute right-0 top-0 h-full px-3 text-[#A1A1A1] hover:text-[#2F7058] transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 font-medium mt-1">{errors.password.message}</p>
          )}
        </div>

        {errors.root && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-md bg-red-50 border border-red-100 flex items-center gap-3 text-red-600"
          >
            <ShieldCheck size={18} />
            <p className="text-sm font-semibold">{errors.root.message}</p>
          </motion.div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="remember" className="rounded border-gray-300 text-[#2F7058] focus:ring-[#2F7058]" />
            <label htmlFor="remember" className="text-sm text-[#7A7A7A] hover:text-[#334155] cursor-pointer transition-colors">Recordarme</label>
          </div>
          <button type="button" className="text-sm font-semibold text-[#2F7058] hover:underline">
            Olvidaste tu contrasena?
          </button>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 bg-[#2F7058] hover:bg-[#255a47] text-white text-base font-bold rounded-lg shadow-lg shadow-[#2F7058]/20 transition-all active:scale-[0.98]"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            'Entrar al sistema'
          )}
        </Button>
      </form>
    </div>
  )
}
