import { saveFile } from './download';

describe('saveFile', () => {
  it('should click a temporary link carrying the file name', () => {
    const link = document.createElement('a');
    const click = spyOn(link, 'click');
    const doc = { createElement: () => link } as unknown as Document;

    saveFile(new Blob(['Nom;Visites']), 'clients-2026-10-05.csv', doc);

    expect(link.download).toBe('clients-2026-10-05.csv');
    expect(link.href).toMatch(/^blob:/);
    expect(click).toHaveBeenCalled();
  });
});
