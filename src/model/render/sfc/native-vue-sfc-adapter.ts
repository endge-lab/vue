import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'

import type { SFCVueRenderAdapter } from '@/domain/types/sfc-render.type'
import { SFCRender_Badge } from '@/ui/render/sfc/SFCRender_Badge'
import { SFCRender_Box } from '@/ui/render/sfc/SFCRender_Box'
import { SFCRender_Checkbox } from '@/ui/render/sfc/SFCRender_Checkbox'
import { SFCRender_DateTime } from '@/ui/render/sfc/SFCRender_DateTime'
import { SFCRender_Divider } from '@/ui/render/sfc/SFCRender_Divider'
import { SFCRender_Dot } from '@/ui/render/sfc/SFCRender_Dot'
import { SFCRender_Flex } from '@/ui/render/sfc/SFCRender_Flex'
import { SFCRender_Grid } from '@/ui/render/sfc/SFCRender_Grid'
import { SFCRender_Icon } from '@/ui/render/sfc/SFCRender_Icon'
import { SFCRender_Input } from '@/ui/render/sfc/SFCRender_Input'
import { SFCRender_Number } from '@/ui/render/sfc/SFCRender_Number'
import { SFCRender_Select } from '@/ui/render/sfc/SFCRender_Select'
import { SFCRender_Text } from '@/ui/render/sfc/SFCRender_Text'
import { SFCRender_Textarea } from '@/ui/render/sfc/SFCRender_Textarea'
import { SFCRender_Table } from '@/ui/render/sfc/SFCRender_Table'

export const NATIVE_VUE_SFC_ADAPTER_ID = 'native-vue'

/** Нативный DOM adapter для Vue render engine. */
export const NativeVueSFCAdapter: SFCVueRenderAdapter = {
  id: NATIVE_VUE_SFC_ADAPTER_ID,
  protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  renderer: 'vue',
  renderers: {
    Text: SFCRender_Text,
    DateTime: SFCRender_DateTime,
    Number: SFCRender_Number,
    Icon: SFCRender_Icon,
    Badge: SFCRender_Badge,
    Dot: SFCRender_Dot,
    Box: SFCRender_Box,
    Flex: SFCRender_Flex,
    Grid: SFCRender_Grid,
    Divider: SFCRender_Divider,
    Input: SFCRender_Input,
    Textarea: SFCRender_Textarea,
    Checkbox: SFCRender_Checkbox,
    Select: SFCRender_Select,
    Table: SFCRender_Table,
  },
}
