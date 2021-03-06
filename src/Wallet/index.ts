import client from 'client';
import { paramsMissing, addressIllegal, addressMissing} from 'const/error';
import { Address, AddrObj, Hex, LangList } from 'const/type';
import { checkParams } from 'utils/tools';
import { newAddr, getId, validateMnemonic, getEntropyFromMnemonic, getAddrsFromMnemonic, isValidHexAddr, getAddrFromMnemonic } from 'utils/address/hdAddr';
import Account from './account';

class Wallet {
    addrList: Array<AddrObj>
    lang: LangList
    pwd: string
    mnemonic: string
    addrNum: number
    addrStartInx: number
    entropy: string
    addrTotalNum: number
    id: Hex
    activeAccountList: Array<Account>
    _client: client

    constructor({
        client, mnemonic, bits=256, addrNum = 1, lang = LangList.english, pwd = ''
    }, {
        addrTotalNum = 10,
        addrStartInx = 0
    }) {
        let err = checkParams({ mnemonic, client }, ['client'], [{
            name: 'mnemonic',
            func: (_mnemonic) => {
                return validateMnemonic(_mnemonic, lang);
            }
        }]);
        if (err) {
            console.error(new Error(err.message));
            return;
        }

        this._client = client;

        this.addrTotalNum = addrTotalNum;
        let _addrNum = +addrNum && +addrNum > 0 ? +addrNum : 1;
        _addrNum = _addrNum > addrTotalNum ? addrTotalNum : _addrNum;
        this.addrNum = _addrNum;
        
        this.lang = lang || LangList.english;
        this.pwd = pwd;
        if (mnemonic) {
            this.mnemonic = mnemonic;
            this.entropy = getEntropyFromMnemonic(mnemonic, this.lang);
        } else {
            const { entropy, mnemonic } = newAddr(bits, this.lang, this.pwd);
            this.mnemonic = mnemonic;
            this.entropy = entropy;
        }

        this.addrStartInx= addrStartInx;
        this.addrList = getAddrsFromMnemonic(this.mnemonic, addrStartInx, this.addrNum, this.lang, this.pwd);
        this.id = getId(this.mnemonic, this.lang);

        this.activeAccountList = [];
    }

    activateAccount({
        address, index = this.addrStartInx
    }: { address?: Address, index?: number }, {
        intervals = 2000, 
        receiveFailAction = null,
        duration = 5 * 60 * 1000
    }: { intervals?: number, receiveFailAction?: null, duration?: number }) {
        index = validAddrParams({
            address, index
        });
        if (index === null) {
            return null;
        }

        let addrObj: AddrObj = this.addrList[index];
        let activeAccount = new Account({
            privateKey: addrObj.privKey,
            client: this._client
        });

        activeAccount.activate(intervals, receiveFailAction);
        if (duration > 0) {
            setTimeout(() => {
                this.freezeAccount(activeAccount);
            }, duration);
        }

        this.activeAccountList.push(activeAccount);
        return activeAccount;
    }

    freezeAccount(activeAccount: Account) {
        if (!this.activeAccountList || !this.activeAccountList.length || !activeAccount) {
            return;
        }

        activeAccount.freeze && activeAccount.freeze();

        let i;
        for (i=0; i<this.activeAccountList.length; i++) {
            if (this.activeAccountList[i] === activeAccount) {
                break;
            }
        }
        this.activeAccountList.splice(i, 1);
        activeAccount = null;
    }

    addAddr() {
        let index =  this.addrList.length;
        if (index >= this.addrTotalNum) {
            return null;
        }

        let addrObj = getAddrFromMnemonic(this.mnemonic, index, this.lang, this.pwd);
        if (!addrObj) {
            return null;
        }
        this.addrList.push(addrObj);
        return addrObj;
    }
}

export const walletAccount = Wallet;

export const account = Account;



function validAddrParams({
    address, index = this.addrStartInx
}: { address?: Address, index?: number }) {
    if (!address && !index && index !== 0) {
        console.error( new Error(`${paramsMissing.message} Address or index.`) );
        return null;
    }

    if (address && !isValidHexAddr) {
        console.error( new Error(`${addressIllegal.message}`) );
        return null;
    }

    if (!address) {
        return index;
    }

    let i;
    for (i = 0; i < this.addrList.length; i++) {
        if (this.addrList[i].hexAddr === address) {
            break;
        }
    }
    if (i === this.addrList.length) {
        console.error( new Error(`${addressMissing.message}`) );
        return null;
    }
    return i;
}
