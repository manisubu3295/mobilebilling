import { IsDateString, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

// Fields of the client's paper warranty card / service record. Everything is
// optional free text — technicians fill in whatever applies to the unit
// (RO: pump, membrane, power; softener/IRF: vessel, valve, media).
const OptionalText = (max = 100) => (target: object, key: string) => {
  IsOptional()(target, key);
  IsString()(target, key);
  MaxLength(max)(target, key);
};

// Date fields accept an ISO date, or empty string / null to clear.
const OptionalDate = () => (target: object, key: string) => {
  ValidateIf((o) => o[key] !== undefined && o[key] !== null && o[key] !== '')(target, key);
  IsDateString()(target, key);
};

export class UpdateWarrantyCardDto {
  // Customer details (shared with the customer record)
  @OptionalText(20) cardNo?: string;
  @OptionalText(300) address?: string;
  @OptionalText() city?: string;
  @OptionalText() landmark?: string;

  @OptionalDate() cardDate?: string | null;

  // Water test
  @OptionalText(30) tds?: string;
  @OptionalText(30) hardness?: string;
  @OptionalText(30) iron?: string;
  @OptionalText() otherImpurities?: string;

  // Product details
  @OptionalText() brand?: string;
  @OptionalText() model?: string;
  @OptionalText() pump?: string;
  @OptionalText() membrane?: string;
  @OptionalText() power?: string;
  @OptionalText() vessel?: string;
  @OptionalText() valve?: string;
  @OptionalText() media?: string;
  @OptionalText() soldBy?: string;
  @OptionalText() installedBy?: string;

  @OptionalDate() amcFrom?: string | null;
  @OptionalDate() amcTo?: string | null;
}
