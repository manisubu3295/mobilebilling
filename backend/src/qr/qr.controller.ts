import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QrService } from './qr.service';
import { BillingService } from '../billing/billing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('qr')
@UseGuards(JwtAuthGuard)
export class QrController {
  constructor(
    private qrService: QrService,
    private billingService: BillingService,
  ) {}

  @Get('invoice/:invoiceId')
  async getInvoiceQr(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: any,
  ) {
    const invoice = await this.billingService.getInvoice(invoiceId, user.storeId);
    const vpa = process.env.STORE_UPI_VPA || '';
    const payload = this.qrService.getInvoiceQrPayload(
      {
        id: invoice!.id,
        invoiceNumber: invoice!.invoiceNumber,
        totalAmount: invoice!.totalAmount.toString(),
        store: invoice!.store,
      },
      vpa,
    );

    return { payload, invoiceNumber: invoice!.invoiceNumber, amount: invoice!.totalAmount };
  }
}
