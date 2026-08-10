import type { BrandingBinding } from '@/app/domain/types/branding.type'
import type { InjectionKey } from 'vue'

export const brandingBindingKey: InjectionKey<BrandingBinding> = Symbol('configurator-branding')
