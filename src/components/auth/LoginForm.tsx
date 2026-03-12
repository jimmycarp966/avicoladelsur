'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { loginSchema, type LoginFormData } from '@/lib/schemas/auth.schema'

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
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
    <Card className="w-full max-w-md mx-auto shadow-2xl border-2 border-primary/20 bg-white">
      <CardHeader className="space-y-6 pb-6">
        <div className="flex items-center justify-center mb-4">
          <Logo size="xl" variant="full" priority light />
        </div>
        <div className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold text-foreground">Bienvenido</CardTitle>
          <CardDescription className="text-base">
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base font-semibold text-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              {...register('email')}
              disabled={isLoading}
              className="h-11 text-base border-2 focus:border-primary"
            />
            {errors.email && (
              <p className="text-sm text-destructive font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base font-semibold text-foreground">Contrasena</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="********"
                {...register('password')}
                disabled={isLoading}
                className="h-11 text-base border-2 focus:border-primary pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive font-medium">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive/20">
              <p className="text-sm text-destructive font-semibold">{errors.root.message}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Iniciando sesion...
              </>
            ) : (
              'Iniciar sesion'
            )}
          </Button>
        </form>

        <div className="pt-4 border-t border-border">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">Olvidaste tu contrasena?</p>
            <Button variant="link" className="p-0 h-auto font-normal text-primary hover:text-primary/80">
              Contacta al administrador del sistema
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
