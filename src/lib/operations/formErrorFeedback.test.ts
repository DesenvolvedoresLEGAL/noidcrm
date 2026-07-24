import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CORE_FIELD_LABELS, showFormErrors } from './formErrorFeedback';
import { CONNECTIVITY_INVENTORY_FIELD_LABELS } from '@/vertical-packs/connectivity/inventory';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));
import { toast } from 'sonner';

const err = (path: string, message: string) => {
  const parts = path.split('.');
  const root: any = {};
  let node = root;
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i];
    if (i === parts.length - 1) node[k] = { message, type: 'validate' };
    else {
      node[k] = {};
      node = node[k];
    }
  }
  return root;
};

describe('formErrorFeedback — Core label surface', () => {
  it('CORE_FIELD_LABELS excludes connectivity keys', () => {
    for (const k of [
      'router_factory',
      'sim_card_factory',
      'router_factory.ssid_factory',
      'router_factory.wifi_password_factory',
      'router_factory.imei',
      'sim_card_factory.iccid',
      'sim_card_factory.apn',
      'sim_card_factory.pin',
    ]) {
      expect(CORE_FIELD_LABELS[k]).toBeUndefined();
    }
  });
  it('keeps core inventory labels', () => {
    expect(CORE_FIELD_LABELS.name).toBe('Nome do item');
    expect(CORE_FIELD_LABELS.serial_number).toBe('Número de série');
  });
});

describe('formErrorFeedback — showFormErrors', () => {
  beforeEach(() => {
    (toast.error as any).mockClear();
  });

  it('works without options and resolves core label', () => {
    showFormErrors(err('name', 'Obrigatório'));
    expect(toast.error).toHaveBeenCalledWith('Nome do item: Obrigatório');
  });

  it('resolves connectivity label when passed via options', () => {
    showFormErrors(err('router_factory.imei', 'Obrigatório'), {
      fieldLabels: CONNECTIVITY_INVENTORY_FIELD_LABELS,
    });
    expect(toast.error).toHaveBeenCalledWith('IMEI: Obrigatório');
  });

  it('custom labels take precedence over Core', () => {
    showFormErrors(err('name', 'X'), { fieldLabels: { name: 'Nome custom' } });
    expect(toast.error).toHaveBeenCalledWith('Nome custom: X');
  });

  it('unknown key falls back to head path', () => {
    showFormErrors(err('unknown_field', 'X'));
    expect(toast.error).toHaveBeenCalledWith('unknown_field: X');
  });

  it('ignores non-options second arg (RHF passes event)', () => {
    showFormErrors(err('name', 'X'), { nativeEvent: {} } as any);
    expect(toast.error).toHaveBeenCalledWith('Nome do item: X');
  });

  it('no errors → generic toast', () => {
    showFormErrors({});
    expect(toast.error).toHaveBeenCalledWith('Revise os campos destacados antes de continuar.');
  });
});
